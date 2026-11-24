"""The SHARED song of a template: made once by ElevenLabs when the admin clicks "Generate song", never per gift.

The song has no name in it. The person's name is spoken over it at render time by JSON2Video (see video/song_spec.py).
Result: the template becomes song_mode 'fixed' (the app hides the song step, the pipeline plays default_song_path),
and `song_json` tells the renderer where the name is spoken.

Cost rules: same prompt = cached MP3 (no call) · daily cap · on failure the previous song stays untouched.
"""
import logging
import time
from datetime import datetime, timedelta, timezone

import httpx

from ..config import get_settings
from ..db import MEDIA_BUCKET, TEMPLATE_BUCKET, db, one, signed_url, upload_bytes
from ..placeholders import strip
from ..providers import elevenlabs
from ..video import song_spec
from .songs import get_or_make_song

log = logging.getLogger("geetzy.song")


def _set(template_id: str, **fields) -> None:
    db().table("templates").update(fields).eq("id", template_id).execute()


def _log_ai(model: str, ms: int, ok: bool, error: str | None) -> None:
    db().table("ai_requests").insert({
        "user_id": None, "gift_id": None, "kind": "song", "model": model, "est_cost_usd": elevenlabs.EST_COST_SONG_USD if ok else 0,
        "provider": "elevenlabs", "ok": ok, "latency_ms": ms, "error": error[:300] if error else None,
    }).execute()


def calls_today() -> int:
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    return db().table("ai_requests").select("id", count="exact", head=True).eq("kind", "song").eq("provider", "elevenlabs") \
        .is_("gift_id", "null").gte("created_at", since).execute().count or 0


def build_spec(tpl: dict) -> dict:
    """The admin's own spec if it is valid, else the default one for this template's length."""
    existing = tpl.get("song_json")
    if existing and not song_spec.validate(existing, duration_sec=tpl["duration_sec"]):
        return existing
    return song_spec.default_spec(tpl["duration_sec"], instrumental=True)


def shared_prompt(tpl: dict, spec: dict) -> str:
    """The admin's audio prompt WITHOUT any {name}-style placeholder, plus the song structure."""
    structure = ", ".join(f"{s['name']} {s['start']}-{s['end']}s" for s in spec.get("sections", []))
    return elevenlabs.build_prompt(
        direction=strip(tpl.get("song_prompt") or tpl.get("prompt") or ""), style=tpl["style"], seconds=tpl["duration_sec"],
        instrumental=bool(spec.get("instrumental", True)), structure=structure,
    )


def generate(template_id: str) -> str:
    """One "Generate song" click. Safe to call twice (claimed with a compare-and-set)."""
    claimed = one(db().table("templates").update({"song_status": "running"}).eq("id", template_id).eq("song_status", "queued").execute())
    if not claimed:
        return "skipped"
    tpl = one(db().table("templates").select("*").eq("id", template_id).execute())
    if not tpl:
        return "missing"
    model = get_settings().elevenlabs_model
    try:
        spec = build_spec(tpl)
        prompt = shared_prompt(tpl, spec)
        instrumental = bool(spec.get("instrumental", True))
        key = elevenlabs.song_hash(prompt, tpl["duration_sec"] * 1000, instrumental)
        cached = one(db().table("song_cache").select("hash").eq("hash", key).execute())
        if not cached and calls_today() + 1 > get_settings().song_jobs_per_day:
            raise RuntimeError("The daily song limit is reached. Try again tomorrow or upload the song yourself.")

        path, _was_cached = get_or_make_song(
            prompt, seconds=tpl["duration_sec"], instrumental=instrumental,
            on_made=lambda ms, ok, err: _log_ai(model, ms, ok, err),
        )
        # The private cache file is copied to the PUBLIC template bucket, where the pipeline expects a template's song.
        url = signed_url(MEDIA_BUCKET, path)
        res = httpx.get(url, timeout=60)  # type: ignore[arg-type]
        res.raise_for_status()
        song_path = upload_bytes(TEMPLATE_BUCKET, f"templates/{template_id}/song_{int(time.time())}.mp3", res.content, "audio/mpeg")

        # new song -> the old preview no longer matches, so it must be made and published again
        _set(template_id, default_song_path=song_path, default_song_start_sec=0, song_mode="fixed", song_instrumental=instrumental,
             song_json=spec, song_status="ready", song_error=None, preview_status="none", preview_error=None, status="draft")
        return "ready"
    except Exception as e:  # noqa: BLE001 — shown to the admin; the previous song stays
        log.exception("song for %s failed", template_id)
        _set(template_id, song_status="error", song_error=str(e)[:300])
        return "error"
