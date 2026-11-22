"""Grok writes the movie template JSON (admin click only).

Cost rules: never per gift · same brief + settings + existing JSON = no call · at most 2 Grok calls per click
(one automatic retry that shows Grok its own validation errors) · a daily cap across all admins.
On any failure the template's previous JSON is left untouched.
"""
import hashlib
import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone

from ..config import get_settings
from ..db import db, one
from ..providers import xai
from ..studio.layouts import get_layout
from ..video import movie_template as mt

log = logging.getLogger("geetzy.movie")

EXAMPLE = {
    "scenes": [
        {"duration": 3, "background": "#1A0B2E", "elements": [
            {"type": "image", "src": "{{photo_1}}", "box": [0.08, 0.1, 0.84, 0.5], "fit": "cover", "zoom": 2, "pan": "right", "z": 1},
            {"type": "text", "text": "Happy Birthday, {{name}}!", "box": [0.05, 0.66, 0.9, 0.16], "size": 0.075, "font": "Playfair Display", "color": "#FFE8A3"},
        ]},
        {"duration": 3, "transition": "fadewhite", "elements": [
            {"type": "image", "src": "{{photo_2}}", "box": [0.08, 0.1, 0.84, 0.5], "fit": "cover", "zoom": 2, "pan": "left", "z": 1},
            {"type": "text", "text": "{{fun_fact}}", "box": [0.05, 0.66, 0.9, 0.16], "size": 0.05, "color": "#FFFFFF"},
        ]},
        {"duration": 3, "transition": "fadewhite", "elements": [
            {"type": "image", "src": "{{photo_3}}", "box": [0.08, 0.1, 0.84, 0.5], "fit": "cover", "zoom": 2, "pan": "top", "z": 1},
            {"type": "text", "text": "With love, {{sender}}", "box": [0.05, 0.66, 0.9, 0.16], "size": 0.06, "font": "Playfair Display"},
        ]},
    ],
    "elements": [
        {"type": "image", "src": "{{background}}", "box": [0, 0, 1, 1], "z": 0},
        {"type": "audio", "src": "{{audio}}"},
    ],
}

SYSTEM = f"""You design short vertical (9:16) greeting videos as a JSON movie template. Reply with ONE JSON object only, no prose.

FORMAT (strict - anything else is rejected):
- Top level has only "scenes" (list, 1-{mt.MAX_SCENES}) and optional "elements" (movie-wide list).
- Scene: {{"duration": seconds {mt.MIN_SCENE_SEC}-{mt.MAX_SCENE_SEC}, "background": "#RRGGBB" (optional), "transition": one of {sorted(mt.TRANSITIONS)} (optional, not on the first scene), "elements": [...]}}
- Element types: "image", "text", "audio" only.
  image: {{"type":"image","src":MARKER,"box":[x,y,w,h],"fit":"cover|contain|fill","zoom":-10..10,"pan":{sorted(mt.PANS)},"z":0-30}}
  text:  {{"type":"text","text":"...","box":[x,y,w,h],"size":0.02-0.2,"color":"#RRGGBB","font":one of {sorted(mt.FONTS)},"weight":400|500|600|700|800|900,"align":"left|center|right","shadow":true|false,"z":0-30}}
  audio: {{"type":"audio","src":"{{{{audio}}}}"}} - only in the top-level "elements", at most one.
- box = [x, y, width, height] as FRACTIONS of the picture (0-1), size = fraction of the picture width. Never use pixels.
- You can NEVER write links. Pictures and sound are MARKERS only:
  photos {{{{photo_1}}}} ... {{{{photo_N}}}} (each user photo; a scene using a photo number the user did not add is dropped automatically)
  text markers inside "text": {{{{name}}}} (who the gift is for), {{{{sender}}}}, {{{{fun_fact}}}}, {{{{occasion}}}}
  {{{{background}}}} (background picture), {{{{art}}}} (decorative frame overlay with a transparent photo hole; put it on top with a high "z")
- Text is max {mt.MAX_TEXT} characters, short and warm, Indian English. Family-friendly. Do not invent facts about people.
- Design so it still works when the user adds only the MINIMUM number of photos. Use {{{{photo_1}}}} first.
- Use one scene per photo (or fewer scenes than photos). Keep text readable on photos (shadow true, light colours).

EXAMPLE (3 photos):
{json.dumps(EXAMPLE, separators=(",", ":"))}
"""


def brief_hash(tpl: dict) -> str:
    raw = json.dumps([tpl.get("movie_prompt", ""), tpl["photos_min"], tpl["photos_max"], tpl["duration_sec"], tpl["style"],
                      tpl.get("layout_id"), tpl["song_mode"], get_settings().xai_model], sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def _user_prompt(tpl: dict, category: str) -> str:
    lines = [
        f"Design brief from the admin:\n{(tpl.get('movie_prompt') or '').strip() or 'A warm, fun greeting video.'}",
        "",
        f"Occasion/category: {category}. Visual style: {tpl['style']}. Total length: {tpl['duration_sec']} s.",
        f"The user adds between {tpl['photos_min']} and {tpl['photos_max']} photos (markers photo_1..photo_{tpl['photos_max']}).",
        "A song plays under the video (include the audio element)." if tpl["song_mode"] != "none" else "There is no song (do not add audio).",
    ]
    layout = get_layout(tpl["layout_id"]) if tpl.get("layout_id") else None
    if layout and layout.kind == "video" and layout.slots:
        s = layout.slots[0]
        lines.append(
            f"A decorative frame overlay is available as {{{{art}}}}. Its photo hole is exactly box [{s.x}, {s.y}, {s.w}, {s.h}]: "
            "place every {{photo_k}} in that box with z 1, and add the {{art}} image on top as a top-level element "
            '({"type":"image","src":"{{art}}","box":[0,0,1,1],"z":10}). Keep text outside that box.'
        )
    return "\n".join(lines)


def _parse(text: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("The reply is not a JSON object.")
    return data


def _log_ai(model: str, ok: bool, started: float, error: str | None) -> None:
    db().table("ai_requests").insert({
        "user_id": None, "gift_id": None, "kind": "movie", "model": model, "est_cost_usd": xai.EST_COST_USD if ok else 0,
        "provider": "xai", "ok": ok, "latency_ms": int((time.monotonic() - started) * 1000), "error": error[:300] if error else None,
    }).execute()


def calls_today() -> int:
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    return db().table("ai_requests").select("id", count="exact", head=True).eq("kind", "movie").eq("provider", "xai") \
        .gte("created_at", since).execute().count or 0


def _set(template_id: str, **fields) -> None:
    db().table("templates").update(fields).eq("id", template_id).execute()


def generate(template_id: str) -> str:
    """Runs one "Generate with Grok" click. Safe to call twice (claimed with a compare-and-set)."""
    claimed = one(db().table("templates").update({"movie_status": "running"}).eq("id", template_id).eq("movie_status", "queued").execute())
    if not claimed:
        return "skipped"
    tpl = one(db().table("templates").select("*, categories(name)").eq("id", template_id).execute())
    if not tpl:
        return "missing"
    s = get_settings()
    try:
        digest = brief_hash(tpl)
        if tpl.get("movie_json") and tpl.get("movie_hash") == digest:
            _set(template_id, movie_status="ready", movie_error=None)  # nothing changed: no xAI call
            return "unchanged"
        if calls_today() + 1 > s.xai_calls_per_day:
            raise RuntimeError("The daily Grok limit is reached. Try again tomorrow or edit the JSON by hand.")

        category = (tpl.get("categories") or {}).get("name") or tpl["occasion"]
        messages = [{"role": "user", "content": _user_prompt(tpl, category)}]
        errors: list[str] = []
        movie: dict | None = None
        for attempt in (1, 2):
            started = time.monotonic()
            try:
                reply = xai.chat_json(SYSTEM, messages)
                _log_ai(s.xai_model, True, started, None)
            except Exception as e:
                _log_ai(s.xai_model, False, started, str(e))
                raise
            try:
                candidate = _parse(reply)
                errors = mt.validate(candidate, photos_min=tpl["photos_min"], photos_max=tpl["photos_max"])
            except (ValueError, json.JSONDecodeError) as e:
                candidate, errors = None, [f"The reply was not valid JSON: {e}"]
            if not errors and candidate:
                movie = candidate
                break
            messages += [
                {"role": "assistant", "content": reply},
                {"role": "user", "content": "That was rejected. Fix these problems and return the full corrected JSON only:\n- " + "\n- ".join(errors[:8])},
            ]
        if movie is None:
            raise RuntimeError("Grok's design was rejected: " + "; ".join(errors[:3]))

        # new design → the old preview no longer matches, so it must be made and published again
        _set(template_id, movie_json=movie, movie_source="grok", movie_status="ready", movie_error=None, movie_hash=digest,
             preview_status="none", preview_error=None, status="draft")
        return "ready"
    except Exception as e:  # noqa: BLE001 — shown to the admin; the previous JSON stays
        log.exception("movie for %s failed", template_id)
        _set(template_id, movie_status="error", movie_error=str(e)[:300])
        return "error"
