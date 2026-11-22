"""Gift pipeline: ElevenLabs song → JSON2Video preview → (after payment) HD.

Nothing here runs "in the background" on Vercel. Each step is started by an HTTP call:
- new gift row → Supabase trigger (pg_net) → POST /internal/gifts/{id}/run → run_gift()
- JSON2Video finished → POST /webhooks/json2video → on_render_done()
- every minute → Supabase pg_cron → POST /internal/sweep → sweep() (retries + safety net)
All functions are safe to call twice.
"""
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone

import httpx

from .config import get_settings
from .db import MEDIA_BUCKET, TEMPLATE_BUCKET, UPLOADS_BUCKET, db, one, public_url, signed_url, upload_bytes
from .placeholders import fill
from .providers import elevenlabs
from .services.songs import get_or_make_song
from .studio import service as studio_service
from .studio.compose import compose_image
from .studio.layouts import get_layout
from .services.render_body import movie_body
from .video.json2video import create_movie, get_movie, split_video_prompt
from .video.watermark import make_preview

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


def _log_ai(
    user_id: str, gift_id: str | None, kind: str, model: str, cost: float, *,
    provider: str | None = None, ok: bool = True, latency_ms: int | None = None, error: str | None = None,
) -> None:
    db().table("ai_requests").insert({
        "user_id": user_id, "gift_id": gift_id, "kind": kind, "model": model, "est_cost_usd": cost,
        "provider": provider, "ok": ok, "latency_ms": latency_ms, "error": (error or None) and error[:300],
    }).execute()


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
        .update({"status": "composing", "progress": PROGRESS["composing"], "attempts": g["attempts"] + 1})
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
    song = one(db().table("gift_songs").select("*").eq("gift_id", g["id"]).execute())
    tpl = one(db().table("templates").select("*").eq("id", g["template_id"]).execute())
    if not tpl:
        raise RuntimeError("Gift is missing its template")

    if tpl["output_type"] == "image":  # photo template: one picture, no song, no JSON2Video
        if not (tpl.get("layout_id") and tpl.get("art_status") == "ready" and tpl.get("art_bg_path")):
            raise RuntimeError("This photo template is not ready (no art)")
        _compose_photo_template(g, tpl)
        return
    mode = tpl["song_mode"]
    if mode not in ("none", "fixed") and not song:
        raise RuntimeError("Gift is missing its song")
    song = song if mode not in ("none", "fixed") else None

    if song and song["source"] == "ai" and not song["audio_path"]:  # a retry after a failed render reuses the song
        _set_status(g["id"], "composing")
        # The admin's audio prompt with {name} {sender} {fun_fact} {occasion} replaced for THIS gift.
        direction = fill(tpl.get("song_prompt") or tpl.get("prompt") or "", name=g["recipient_name"], sender=g["sender_name"],
                         fun_fact=g["fun_fact"], occasion=g["occasion"])
        prompt = elevenlabs.build_prompt(direction=direction, style=tpl["style"], mood=song["mood"] or "happy",
                                         singer=song["singer"] or "female", seconds=tpl["duration_sec"])
        path, _cached = get_or_make_song(
            prompt, seconds=tpl["duration_sec"], instrumental=bool(tpl.get("song_instrumental")),
            on_made=lambda ms, ok, err: _log_ai(g["user_id"], g["id"], "song", get_settings().elevenlabs_model,
                                                elevenlabs.EST_COST_SONG_USD if ok else 0.0, provider="elevenlabs",
                                                ok=ok, latency_ms=ms, error=err),
        )
        db().table("gift_songs").update({"audio_path": path, "model": get_settings().elevenlabs_model}).eq("gift_id", g["id"]).execute()
        song = {**song, "audio_path": path}

    _set_status(g["id"], "rendering", error=None)
    start_render(g, "preview", song=song, tpl=tpl)


# ───────────────────────────────────────────────────────────── photo templates (styled still image)
def _compose_photo_template(g: dict, tpl: dict) -> None:
    """Template Studio photo template: the user's photos go into the layout's slots on the template art (Pillow only)."""
    layout = get_layout(tpl["layout_id"])
    if not layout:
        raise RuntimeError("Template layout not found")
    _set_status(g["id"], "composing")
    photos = db().table("gift_photos").select("storage_path").eq("gift_id", g["id"]).order("position").execute().data
    raw: list[bytes] = []
    for p in photos:
        url = signed_url(UPLOADS_BUCKET, p["storage_path"])
        if url:
            r = httpx.get(url, timeout=60)
            r.raise_for_status()
            raw.append(r.content)
    if not raw:
        raise RuntimeError("Photos not found in storage")
    bg = httpx.get(public_url(TEMPLATE_BUCKET, tpl["art_bg_path"]), timeout=60)
    bg.raise_for_status()
    full = compose_image(bg.content, layout.slots, raw, recipient=g["recipient_name"], sender=g["sender_name"], occasion=g["occasion"])

    base = f"{g['user_id']}/{g['id']}"
    full_path = upload_bytes(MEDIA_BUCKET, f"{base}/full.jpg", full, "image/jpeg")
    preview_path = upload_bytes(MEDIA_BUCKET, f"{base}/preview.jpg", make_preview(full), "image/jpeg")
    # hd_url is only returned to the app once the gift is paid, so storing hd_path now is safe.
    _set_status(g["id"], "preview_ready", preview_path=preview_path, hd_path=full_path, error=None)
    db().rpc("increment_made_count", {"p_template_id": g["template_id"]}).execute()


# ───────────────────────────────────────────────────────────── rendering
def start_render(g: dict, kind: str, *, song: dict | None = None, tpl: dict | None = None) -> str:
    s = get_settings()
    tpl = tpl or one(db().table("templates").select("*").eq("id", g["template_id"]).execute())
    if not tpl:
        raise RuntimeError("Gift is missing its template")
    mode = tpl["song_mode"]
    silent = mode == "none"
    fixed = mode == "fixed"  # the template's own cropped song, same for every gift (no AI cost)
    song = None if (silent or fixed) else (song or one(db().table("gift_songs").select("*").eq("gift_id", g["id"]).execute()))
    if not silent and not fixed and not song:
        raise RuntimeError("Gift is missing its song")

    photos = db().table("gift_photos").select("storage_path").eq("gift_id", g["id"]).order("position").execute().data
    photo_urls = [u for p in photos if (u := signed_url(UPLOADS_BUCKET, p["storage_path"]))]
    audio_url: str | None = None
    audio_ref, seek, lines, fade = "", 0.0, [], bool(song["fade"]) if song else False
    if fixed:
        audio_ref, seek, fade = tpl["default_song_path"], float(tpl.get("default_song_start_sec") or 0), True
        audio_url = public_url(TEMPLATE_BUCKET, audio_ref)
    elif song and song["source"] == "ai":
        audio_ref = song["audio_path"]
        audio_url = signed_url(MEDIA_BUCKET, audio_ref)
        lines = [line for line in (song["lyrics"] or "").splitlines() if line.strip()]
    elif song:
        audio_ref, seek = song["upload_path"], float(song["trim_start_sec"] or 0)
        audio_url = signed_url(UPLOADS_BUCKET, audio_ref)
    if ((song or fixed) and not audio_url) or not photo_urls:
        raise RuntimeError("Song or photos not found in storage")

    # Template Studio video: photos go into the frame, the art overlay (transparent hole) sits on top.
    layout = get_layout(tpl["layout_id"]) if tpl.get("layout_id") else None
    studio_art = public_url(TEMPLATE_BUCKET, tpl.get("art_path")) if layout and tpl.get("art_status") == "ready" else None
    # Admin's video prompt → opening headline (line 1) and closing caption (line 2).
    headline, closing = split_video_prompt(fill(tpl.get("video_prompt") or "", name=g["recipient_name"], sender=g["sender_name"],
                                                fun_fact=g["fun_fact"], occasion=g["occasion"]))

    # Never pay JSON2Video twice for the exact same request (retry, double webhook, sweep racing the trigger).
    fingerprint = hashlib.sha256(json.dumps(
        [kind, [p["storage_path"] for p in photos], audio_ref, seek, tpl["updated_at"], headline, closing, g["recipient_name"], g["sender_name"]],
        sort_keys=True).encode()).hexdigest()
    twin = one(db().table("render_jobs").select("id").eq("gift_id", g["id"]).eq("kind", kind).eq("input_hash", fingerprint)
               .in_("status", ["pending", "running"]).limit(1).execute())
    if twin:
        return twin["id"]

    job = one(db().table("render_jobs").insert({"gift_id": g["id"], "kind": kind, "input_hash": fingerprint}).execute())
    webhook = f"{s.base_url}/webhooks/json2video?secret={s.webhook_secret}&job={job['id']}"
    body = movie_body(
        tpl, kind=kind, occasion=g["occasion"], recipient=g["recipient_name"], sender=g["sender_name"], fun_fact=g["fun_fact"],
        photo_urls=photo_urls, audio_url=audio_url, audio_seek=seek, fade=fade, lyric_lines=lines, art_url=studio_art,
        background_url=public_url(TEMPLATE_BUCKET, tpl.get("art_bg_path")) if tpl.get("art_status") == "ready" else None,
        slot=layout.slots[0] if studio_art and layout else None, watermark=True, webhook_url=webhook,
        client_data={"giftId": g["id"], "jobId": job["id"], "kind": kind}, headline=headline, closing=closing,
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
def mark_paid(g: dict, *, provider: str, purchase_token: str | None, amount_inr: int | None = None) -> None:
    """provider "credit" = the admin granted free videos: nothing is charged (amount 0)."""
    db().table("payments").insert({
        "gift_id": g["id"], "user_id": g["user_id"], "provider": provider, "purchase_token": purchase_token,
        "amount_inr": g["price_inr"] if amount_inr is None else amount_inr,
        "status": "verified", "verified_at": _now().isoformat(),
    }).execute()
    _set_status(g["id"], "paid")
    if g.get("hd_path"):  # photo templates already have the full-size file
        return
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
    try:
        for k, v in studio_service.sweep_templates().items():
            done[f"templates_{k}"] = v
    except Exception:  # noqa: BLE001 — never let template housekeeping break the gift safety net
        log.exception("template sweep failed")
    return done
