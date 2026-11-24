"""The personal song a user makes on the song screen, BEFORE the gift exists.

Rules (they protect the ElevenLabs bill):
  - one song per create flow: the app makes a uuid (draft id) per flow, and the draft row is claimed first, so a double
    tap or a second request with the same id is refused (402), never paid twice;
  - a daily cap of new drafts per user (429);
  - the same prompt is never paid twice (song cache);
  - a failed ElevenLabs call frees the try again (the row is removed), because nothing was made.
The gift later reuses this MP3 (api/gifts.py puts its path into gift_songs.audio_path), so the video step makes no second song.
"""
import logging
import time
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from ..auth import AuthUser
from ..config import get_settings
from ..db import MEDIA_BUCKET, db, one, signed_url
from ..providers import elevenlabs
from ..schemas import SongDraft, SongDraftInput
from .song_prompt import build_user_prompt
from .songs import get_or_make_song

log = logging.getLogger("geetzy.song_draft")


def _log_ai(user_id: str, ms: int, ok: bool, error: str | None) -> None:
    db().table("ai_requests").insert({
        "user_id": user_id, "gift_id": None, "kind": "song", "model": get_settings().elevenlabs_model,
        "est_cost_usd": elevenlabs.EST_COST_SONG_USD if ok else 0, "provider": "elevenlabs", "ok": ok,
        "latency_ms": ms, "error": (error or None) and error[:300],
    }).execute()


def _friendly(error: Exception) -> HTTPException:
    text = str(error).lower()
    if any(w in text for w in ("bad_prompt", "copyright", "terms", "policy", "moderation")):
        return HTTPException(422, "We could not use that idea. Please describe it without singer, song or film names.")
    return HTTPException(502, "We could not make the song right now. Please try again in a minute.")


def make_draft(user: AuthUser, body: SongDraftInput) -> SongDraft:
    s = get_settings()
    tpl = one(db().table("templates").select("*").eq("id", body.template_id).eq("is_active", True).eq("status", "published").execute())
    if not tpl:
        raise HTTPException(404, "Template not found")
    if tpl["song_mode"] not in ("ai", "both"):
        raise HTTPException(422, "This template does not use an AI song.")

    existing = one(db().table("song_drafts").select("user_id,tries").eq("id", body.draft_id).execute())
    if existing:
        if existing["user_id"] != user.id:
            raise HTTPException(403, "Not your song")
        raise HTTPException(402, "One song per video. Your song is ready; extra songs are coming soon.")

    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    made_today = db().table("song_drafts").select("id", count="exact", head=True).eq("user_id", user.id).gte("created_at", since).execute().count or 0
    if made_today >= s.song_drafts_per_day:
        raise HTTPException(429, "You made a lot of songs today. Please try again tomorrow.")

    prefs = body.prefs.model_dump()
    # Claim the id first: the primary key makes a double tap fail instead of paying twice.
    try:
        db().table("song_drafts").insert({
            "id": body.draft_id, "user_id": user.id, "template_id": tpl["id"], "tries": 1,
            "inputs": {"mood": body.mood, "singer": body.singer, "prefs": prefs},
        }).execute()
    except Exception as e:  # noqa: BLE001 — duplicate key = someone else (or a double tap) already claimed it
        log.info("draft %s not claimed: %s", body.draft_id, e)
        raise HTTPException(402, "One song per video. Your song is ready; extra songs are coming soon.")

    seconds = int(tpl["duration_sec"])
    prompt = build_user_prompt(
        direction=_direction(tpl, body), style=tpl["style"], occasion=tpl["occasion"], name=body.recipient_name,
        sender=body.sender_name, fun_fact=body.fun_fact, mood=body.mood, singer=body.singer, prefs=prefs, seconds=seconds,
        instrumental=bool(tpl.get("song_instrumental")),
    )
    started = time.monotonic()
    made = {"called": False}

    def on_made(ms: int, ok: bool, err: str | None) -> None:
        made["called"] = True
        _log_ai(user.id, ms, ok, err)

    try:
        path, _cached = get_or_make_song(prompt, seconds=seconds, instrumental=bool(tpl.get("song_instrumental")), on_made=on_made)
    except Exception as e:  # noqa: BLE001 — nothing was made, so the user keeps their try
        log.exception("song draft %s failed after %.0f s", body.draft_id, time.monotonic() - started)
        db().table("song_drafts").delete().eq("id", body.draft_id).execute()
        raise _friendly(e)

    db().table("song_drafts").update({"audio_path": path, "prompt_hash": elevenlabs.song_hash(prompt, seconds * 1000, False)}) \
        .eq("id", body.draft_id).execute()
    url = signed_url(MEDIA_BUCKET, path)
    if not url:
        raise HTTPException(502, "We could not load the song. Please try again.")
    return SongDraft(audio_url=url, duration_sec=seconds, tries_used=1, tries_left=0)  # one song per video; a paid re-make comes later


def _direction(tpl: dict, body: SongDraftInput) -> str:
    from ..placeholders import fill  # noqa: PLC0415
    return fill(tpl.get("song_prompt") or tpl.get("prompt") or "", name=body.recipient_name, sender=body.sender_name,
                fun_fact=body.fun_fact, occasion=tpl["occasion"])


def approved_draft(user_id: str, draft_id: str) -> dict:
    """The user's finished draft for create_gift. Raises 422 when it is missing, someone else's, or empty."""
    row = one(db().table("song_drafts").select("user_id,audio_path,inputs").eq("id", draft_id).execute())
    if not row or row["user_id"] != user_id or not row["audio_path"]:
        raise HTTPException(422, "Your song was not found. Please make it again.")
    return row
