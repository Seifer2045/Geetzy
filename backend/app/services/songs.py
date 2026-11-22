"""AI song with a cache, so the same ElevenLabs prompt is never paid for twice."""
import logging
import time
from typing import Callable

from ..db import MEDIA_BUCKET, db, one, upload_bytes
from ..providers import elevenlabs

log = logging.getLogger("geetzy.songs")


def get_or_make_song(
    prompt: str, *, seconds: int, instrumental: bool,
    on_made: Callable[[int, bool, str | None], None] | None = None,
) -> tuple[str, bool]:
    """(path in the gift-media bucket, was_cached).

    `on_made(latency_ms, ok, error)` is called only when ElevenLabs was really called (for the cost dashboard).
    """
    key = elevenlabs.song_hash(prompt, seconds * 1000, instrumental)
    hit = one(db().table("song_cache").select("audio_path").eq("hash", key).execute())
    if hit:
        return hit["audio_path"], True

    started = time.monotonic()
    try:
        audio = elevenlabs.compose_song(prompt, seconds=seconds, instrumental=instrumental)
    except Exception as e:
        if on_made:
            on_made(int((time.monotonic() - started) * 1000), False, str(e))
        raise
    if on_made:
        on_made(int((time.monotonic() - started) * 1000), True, None)
    path = upload_bytes(MEDIA_BUCKET, f"cache/{key}.mp3", audio, "audio/mpeg")
    db().table("song_cache").upsert({"hash": key, "audio_path": path}).execute()
    return path, False
