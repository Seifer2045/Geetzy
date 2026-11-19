"""Gift pipeline: lyrics → Lyria song → JSON2Video preview → (after payment) HD.

Nothing here runs "in the background" on Vercel. Each step is started by an HTTP call:
- new gift row → Supabase trigger (pg_net) → POST /internal/gifts/{id}/run → run_gift()
- JSON2Video finished → POST /webhooks/json2video → on_render_done()
- every minute → Supabase pg_cron → POST /internal/sweep → sweep() (retries + safety net)
All functions are safe to call twice.
"""
import logging
from datetime import datetime, timedelta, timezone

import httpx

from .ai import gemini, loudly
from .ai.gemini import EST_COST_LYRICS_USD, write_lyrics
from .config import get_settings
from .db import MEDIA_BUCKET, UPLOADS_BUCKET, db, one, signed_url, upload_bytes
from .video.json2video import MovieInput, build_movie, create_movie, get_movie

log = logging.getLogger("geetzy.pipeline")

MAX_ATTEMPTS = 3
PROGRESS = {
    "queued": 0.05,
    "writing_lyrics": 0.2,
    "composing": 0.45,
    "rendering": 0.75,
    "preview_ready": 1.0,
    "paid": 1.0,
    "failed": 0.0,
}
RETRY_AFTER = timedelta(seconds=60)
STUCK_AFTER = timedelta(minutes=6)  # longer than the 300 s function limit
POLL_RENDER_AFTER = timedelta(minutes=3)
RENDER_TIMEOUT = timedelta(minutes=20)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ago(delta: timedelta) -> str:
    return (_now() - delta).isoformat()


def _older_than(ts: str, delta: timedelta) -> bool:
    return datetime.fromisoformat(ts) < _now() - delta


def _gift(gift_id: str) -> dict | None:
    return one(db().table("gifts").select("*").eq("id", gift_id).execute())


def _update_gift(gift_id: str, **fields) -> None:
    db().table("gifts").update(fields).eq("id", gift_id).execute()


def _set_status(gift_id: str, status: str, **fields) -> None:
    _update_gift(gift_id, status=status, progress=PROGRESS[status], **fields)


def _log_ai(user_id: str, gift_id: str | None, kind: str, model: str, cost: float) -> None:
    db().table("ai_requests").insert(
        {"user_id": user_id, "gift_id": gift_id, "kind": kind, "model": model, "est_cost_usd": cost}
    ).execute()


# ───────────────────────────────────────────────────────────── step 1+2: song, then preview render
def run_gift(gift_id: str) -> str:
    g = _gift(gift_id)
    if not g or g["status"] != "queued" or g["deleted_at"]:
        return "skipped"
    if g["attempts"] >= MAX_ATTEMPTS:
        _set_status(gift_id, "failed", error=g["error"] or "Too many attempts")
        return "failed"

    # Claim it (only one runner wins, even if trigger and sweep fire together).
    claimed = one(
        db().table("gifts")
        .update({"status": "writing_lyrics", "progress": PROGRESS["writing_lyrics"], "attempts": g["attempts"] + 1})
        .eq("id", gift_id).eq("status", "queued").eq("attempts", g["attempts"])
        .execute()
    )
    if not claimed:
        return "skipped"

    try:
        _make_song_and_render(claimed)
        return "rendering"
    except Exception as e:  # noqa: BLE001 — any failure: retry later or give up
        log.exception("gift %s failed (attempt %s)", gift_id, claimed["attempts"])
        retry = claimed["attempts"] < MAX_ATTEMPTS
        _set_status(gift_id, "queued" if retry else "failed", error=str(e)[:500])
        return "retry" if retry else "failed"


def _make_song_and_render(g: dict) -> None:
    s = get_settings()
    song = one(db().table("gift_songs").select("*").eq("gift_id", g["id"]).execute())
    tpl = one(db().table("templates").select("*").eq("id", g["template_id"]).execute())
    if not song or not tpl:
        raise RuntimeError("Gift is missing its song or template")

    if song["source"] == "ai":
        if not song["lyrics"]:
            res = write_lyrics(occasion=g["occasion"], name=g["recipient_name"], fun_fact=g["fun_fact"],
                               mood=song["mood"], version=song["version"] or 1)
            _log_ai(g["user_id"], g["id"], "lyrics", s.gemini_text_model, EST_COST_LYRICS_USD)
            db().table("gift_songs").update({"lyrics": res.lyrics, "title": res.title}).eq("gift_id", g["id"]).execute()
            song = {**song, "lyrics": res.lyrics, "title": res.title}

        if not song["audio_path"]:  # a retry after a failed render reuses the song
            _set_status(g["id"], "composing")
            audio, model, cost = _compose(tpl["style"], song)
            _log_ai(g["user_id"], g["id"], "song", model, cost)
            path = upload_bytes(MEDIA_BUCKET, f"{g['user_id']}/{g['id']}/song.mp3", audio, "audio/mpeg")
            db().table("gift_songs").update({"audio_path": path, "model": model}).eq("gift_id", g["id"]).execute()
            song = {**song, "audio_path": path}

    _set_status(g["id"], "rendering", error=None)
    start_render(g, "preview", song=song, tpl=tpl)


def _compose(style: str, song: dict) -> tuple[bytes, str, float]:
    """MP3 bytes + model name + estimated cost, from the provider set in SONG_PROVIDER."""
    s = get_settings()
    if s.song_provider == "lyria":
        prompt = gemini.song_prompt(style=style, mood=song["mood"], singer=song["singer"], lyrics=song["lyrics"])
        return gemini.compose_song(prompt), s.lyria_model, gemini.EST_COST_SONG_USD
    prompt = loudly.music_prompt(style=style, mood=song["mood"])
    return loudly.compose_song(prompt), "loudly", loudly.EST_COST_SONG_USD


# ───────────────────────────────────────────────────────────── rendering
def start_render(g: dict, kind: str, *, song: dict | None = None, tpl: dict | None = None) -> str:
    s = get_settings()
    song = song or one(db().table("gift_songs").select("*").eq("gift_id", g["id"]).execute())
    tpl = tpl or one(db().table("templates").select("*").eq("id", g["template_id"]).execute())
    if not song or not tpl:
        raise RuntimeError("Gift is missing its song or template")

    photos = db().table("gift_photos").select("storage_path").eq("gift_id", g["id"]).order("position").execute().data
    photo_urls = [u for p in photos if (u := signed_url(UPLOADS_BUCKET, p["storage_path"]))]
    if song["source"] == "ai":
        audio_url, seek = signed_url(MEDIA_BUCKET, song["audio_path"]), 0.0
        lines = [line for line in (song["lyrics"] or "").splitlines() if line.strip()]
    else:
        audio_url, seek = signed_url(UPLOADS_BUCKET, song["upload_path"]), float(song["trim_start_sec"] or 0)
        lines = []
    if not audio_url or not photo_urls:
        raise RuntimeError("Song or photos not found in storage")

    job = one(db().table("render_jobs").insert({"gift_id": g["id"], "kind": kind}).execute())
    webhook = f"{s.base_url}/webhooks/json2video?secret={s.webhook_secret}&job={job['id']}"
    body = build_movie(
        MovieInput(
            kind=kind,  # type: ignore[arg-type]
            occasion=g["occasion"],
            style=tpl["style"],
            recipient_name=g["recipient_name"],
            sender_name=g["sender_name"],
            photo_urls=photo_urls,
            audio_url=audio_url,
            audio_seek=seek,
            fade=bool(song["fade"]),
            lyric_lines=lines,
            color_from=tpl["color_from"],
            color_to=tpl["color_to"],
            render_config=tpl["render_config"] or {},
            duration_sec=tpl["duration_sec"],
        ),
        webhook_url=webhook,
        client_data={"giftId": g["id"], "jobId": job["id"], "kind": kind},
    )
    try:
        project = create_movie(body)
    except Exception as e:
        db().table("render_jobs").update({"status": "error", "error": str(e)[:500], "finished_at": _now().isoformat()}).eq("id", job["id"]).execute()
        raise
    db().table("render_jobs").update({"provider_project_id": project, "status": "running"}).eq("id", job["id"]).execute()
    return job["id"]


def on_render_done(job_id: str, *, success: bool, video_url: str | None, error: str | None) -> str:
    job = one(db().table("render_jobs").select("*").eq("id", job_id).execute())
    if not job or job["status"] in ("done", "error"):
        return "skipped"
    g = _gift(job["gift_id"])
    if not g:
        return "skipped"
    finished = {"finished_at": _now().isoformat()}

    if success and video_url:
        video = httpx.get(video_url, timeout=120, follow_redirects=True)
        video.raise_for_status()
        path = upload_bytes(MEDIA_BUCKET, f"{g['user_id']}/{g['id']}/{job['kind']}.mp4", video.content, "video/mp4")
        db().table("render_jobs").update({"status": "done", **finished}).eq("id", job_id).execute()
        if job["kind"] == "hd":
            _update_gift(g["id"], hd_path=path)
        elif g["status"] == "rendering":
            _set_status(g["id"], "preview_ready", preview_path=path, error=None)
            db().rpc("increment_made_count", {"p_template_id": g["template_id"]}).execute()
        else:
            _update_gift(g["id"], preview_path=path)
        return "done"

    db().table("render_jobs").update({"status": "error", "error": (error or "Render failed")[:500], **finished}).eq("id", job_id).execute()
    if job["kind"] == "preview" and g["status"] == "rendering":
        retry = g["attempts"] < MAX_ATTEMPTS
        _set_status(g["id"], "queued" if retry else "failed", error=error or "Render failed")
    # HD failures are retried by sweep()
    return "error"


# ───────────────────────────────────────────────────────────── payment → HD
def mark_paid(g: dict, *, provider: str, purchase_token: str | None) -> None:
    db().table("payments").insert({
        "gift_id": g["id"], "user_id": g["user_id"], "provider": provider, "purchase_token": purchase_token,
        "amount_inr": g["price_inr"], "status": "verified", "verified_at": _now().isoformat(),
    }).execute()
    _set_status(g["id"], "paid")
    try:
        start_render({**g, "status": "paid"}, "hd")
    except Exception:  # noqa: BLE001 — sweep() retries the HD render
        log.exception("HD render for %s not started", g["id"])


# ───────────────────────────────────────────────────────────── safety net (every minute)
def sweep() -> dict[str, int]:
    done = {"requeued": 0, "dispatched": 0, "polled": 0, "hd_started": 0}

    # 1) gifts stuck mid-step (function died) → back to the queue
    stuck = db().table("gifts").select("id, attempts").in_("status", ["writing_lyrics", "composing"]) \
        .lt("updated_at", _ago(STUCK_AFTER)).is_("deleted_at", "null").limit(20).execute().data
    for g in stuck:
        status = "queued" if g["attempts"] < MAX_ATTEMPTS else "failed"
        _set_status(g["id"], status, error="Timed out, retrying" if status == "queued" else "Timed out")
        done["requeued"] += 1

    # 2) queued gifts nobody picked up (trigger missed, or waiting for a retry) → start them
    waiting = db().table("gifts").select("id").eq("status", "queued").lt("updated_at", _ago(RETRY_AFTER)) \
        .is_("deleted_at", "null").order("updated_at").limit(5).execute().data
    for g in waiting:
        db().rpc("call_backend", {"p_path": f"/internal/gifts/{g['id']}/run"}).execute()
        done["dispatched"] += 1

    # 3) renders whose webhook never arrived → ask JSON2Video
    running = db().table("render_jobs").select("*").in_("status", ["pending", "running"]) \
        .lt("created_at", _ago(POLL_RENDER_AFTER)).limit(10).execute().data
    for job in running:
        done["polled"] += 1
        if not job["provider_project_id"]:
            if _older_than(job["created_at"], RENDER_TIMEOUT):
                on_render_done(job["id"], success=False, video_url=None, error="Render never started")
            continue
        try:
            movie = get_movie(job["provider_project_id"])
        except Exception:  # noqa: BLE001
            log.exception("status check failed for job %s", job["id"])
            continue
        if movie.get("status") == "done":
            on_render_done(job["id"], success=True, video_url=movie.get("url"), error=None)
        elif movie.get("status") == "error" or _older_than(job["created_at"], RENDER_TIMEOUT):
            on_render_done(job["id"], success=False, video_url=None, error=movie.get("message") or "Render timed out")

    # 4) paid gifts without HD and no HD render in progress → (re)start HD, max 3 tries
    paid = db().table("gifts").select("*").eq("status", "paid").is_("hd_path", "null").limit(5).execute().data
    for g in paid:
        jobs = db().table("render_jobs").select("status").eq("gift_id", g["id"]).eq("kind", "hd").execute().data
        if any(j["status"] in ("pending", "running") for j in jobs) or sum(j["status"] == "error" for j in jobs) >= MAX_ATTEMPTS:
            continue
        try:
            start_render(g, "hd")
            done["hd_started"] += 1
        except Exception:  # noqa: BLE001
            log.exception("HD render for %s not started", g["id"])
    return done
