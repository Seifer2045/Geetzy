"""Template Studio jobs, started by Supabase (templates row → trigger → pg_net → /internal/templates/{id}/art|preview).

  run_art      Takes the background the admin UPLOADED (no AI), fits it to 9:16, and for video layouts adds our
               frame overlay (transparent holes). Pillow only, so it costs nothing.
  run_preview  Renders the template exactly like a user's gift, with built-in sample photos + a sample name.
               Photo templates: in-process (Pillow). Videos: JSON2Video, finished by the webhook.
All steps are safe to call twice (claimed with a compare-and-set on the status column).
"""
import logging
import time
from datetime import datetime, timedelta, timezone

import httpx

from ..config import get_settings
from ..db import MEDIA_BUCKET, TEMPLATE_BUCKET, db, one, public_url, signed_url, upload_bytes
from ..placeholders import fill
from ..providers import elevenlabs
from ..services.songs import get_or_make_song
from ..services.render_body import movie_body
from ..video.json2video import create_movie, get_movie, split_video_prompt
from ..video.watermark import shrink_photo
from . import art as art_mod
from .compose import compose_image
from .layouts import get_layout, FREE_LAYOUT
from .samples import SAMPLE_FUN_FACT, SAMPLE_NAME, SAMPLE_SENDER, sample_photos

log = logging.getLogger("geetzy.studio")

REDISPATCH_AFTER = timedelta(minutes=2)
STUCK_AFTER = timedelta(minutes=6)
RENDER_TIMEOUT = timedelta(minutes=20)
POLL_RENDER_AFTER = timedelta(minutes=3)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ago(delta: timedelta) -> str:
    return (_now() - delta).isoformat()


def _template(template_id: str) -> dict | None:
    return one(db().table("templates").select("*, categories(name)").eq("id", template_id).execute())


def _set(template_id: str, **fields) -> None:
    db().table("templates").update(fields).eq("id", template_id).execute()


def _claim(template_id: str, column: str) -> bool:
    """queued → running, only one runner wins."""
    row = one(db().table("templates").update({column: "running"}).eq("id", template_id).eq(column, "queued").execute())
    return bool(row)


def _category_name(tpl: dict) -> str:
    return ((tpl.get("categories") or {}).get("name")) or tpl["occasion"]


def _log_ai(kind: str, provider: str, model: str, cost: float, *, ok: bool, started: float, error: str | None = None) -> None:
    db().table("ai_requests").insert({
        "user_id": None, "gift_id": None, "kind": kind, "model": model, "est_cost_usd": cost if ok else 0,
        "provider": provider, "ok": ok, "latency_ms": int((time.monotonic() - started) * 1000),
        "error": error[:300] if error else None,
    }).execute()


def _download(url: str) -> bytes:
    r = httpx.get(url, timeout=60, follow_redirects=True)
    r.raise_for_status()
    return r.content


# ───────────────────────────────────────────────────────────── art
def run_art(template_id: str) -> str:
    tpl = _template(template_id)
    if not tpl:
        return "missing"
    if not _claim(template_id, "art_status"):
        return "skipped"
    try:
        layout = get_layout(tpl["layout_id"]) if tpl.get("layout_id") else None
        if not layout:
            raise RuntimeError("Pick a layout first")
        if (layout.kind == "image") != (tpl["output_type"] == "image"):
            raise RuntimeError(f"Layout '{layout.name}' does not fit this kind of template")

        # The admin's uploaded background, or (free) a gradient in the template colours.
        if tpl.get("art_upload_path"):
            raw = _download(public_url(TEMPLATE_BUCKET, tpl["art_upload_path"]))  # type: ignore[arg-type]
        else:
            raw = art_mod.gradient_background(tpl["color_from"], tpl["color_to"])

        bg = art_mod.background_jpeg(raw)
        base, stamp = f"templates/{template_id}", int(time.time())  # versioned names: no stale CDN cache
        bg_path = upload_bytes(TEMPLATE_BUCKET, f"{base}/bg_{stamp}.jpg", bg, "image/jpeg")
        fields = {
            "art_bg_path": bg_path, "art_path": None, "thumb_path": bg_path,
            # new art → the old preview no longer matches, so it must be re-made and re-published.
            # "Save & generate preview" asked for the preview too: queueing it fires the DB trigger again.
            "art_status": "ready", "art_error": None, "status": "draft", "auto_preview": False,
            "preview_status": "queued" if tpl.get("auto_preview") and tpl.get("movie_status") not in ("queued", "running") else "none", "preview_error": None,
        }
        if layout.kind == "video" and layout.id != FREE_LAYOUT:
            overlay = art_mod.frame_overlay(bg, layout.slots)
            fields["art_path"] = upload_bytes(TEMPLATE_BUCKET, f"{base}/art_{stamp}.png", overlay, "image/png")
        _set(template_id, **fields)
        return "ready"
    except Exception as e:  # noqa: BLE001 — shown to the admin
        log.exception("art for %s failed", template_id)
        _set(template_id, art_status="error", art_error=str(e)[:300])
        return "error"


# ───────────────────────────────────────────────────────────── preview
def run_preview(template_id: str) -> str:
    tpl = _template(template_id)
    if not tpl:
        return "missing"
    if not _claim(template_id, "preview_status"):
        return "skipped"
    try:
        layout = get_layout(tpl["layout_id"]) if tpl.get("layout_id") else None
        if not layout or tpl["art_status"] != "ready" or not tpl.get("art_bg_path"):
            raise RuntimeError("Generate the art first")
        if tpl["output_type"] == "image":
            return _preview_image(tpl, layout)
        return _preview_video(tpl, layout)
    except Exception as e:  # noqa: BLE001
        log.exception("preview for %s failed", template_id)
        _set(template_id, preview_status="error", preview_error=str(e)[:300])
        return "error"


def _preview_image(tpl: dict, layout) -> str:
    bg = _download(public_url(TEMPLATE_BUCKET, tpl["art_bg_path"]))  # type: ignore[arg-type]
    full = compose_image(bg, layout.slots, sample_photos(layout.photo_count),
                         recipient=SAMPLE_NAME, sender=SAMPLE_SENDER, occasion=tpl["occasion"])
    path = upload_bytes(TEMPLATE_BUCKET, f"templates/{tpl['id']}/preview_{int(time.time())}.jpg", shrink_photo(full, 720), "image/jpeg")
    _set(tpl["id"], preview_video_path=path, preview_url=public_url(TEMPLATE_BUCKET, path), thumb_path=path,
         preview_status="ready", preview_error=None)
    return "ready"


def _sample_song(tpl: dict) -> tuple[str | None, int]:
    """(audio url, seek seconds) for the admin's preview.

    Fixed/own song → the admin's file (free). "upload" mode → silent (users bring their song).
    AI → one ElevenLabs call, cached by prompt so re-rendering the preview does not pay again.
    """
    mode = tpl["song_mode"]
    if mode == "none" or (mode == "upload" and not tpl.get("default_song_path")):
        return None, 0
    if tpl.get("default_song_path"):
        return public_url(TEMPLATE_BUCKET, tpl["default_song_path"]), int(tpl.get("default_song_start_sec") or 0)
    direction = fill(tpl["song_prompt"], name=SAMPLE_NAME, sender=SAMPLE_SENDER, fun_fact=SAMPLE_FUN_FACT,
                     occasion=_category_name(tpl))
    prompt = elevenlabs.build_prompt(direction=direction, style=tpl["style"], seconds=tpl["duration_sec"])
    model = get_settings().elevenlabs_model

    def log_call(ms: int, ok: bool, err: str | None) -> None:
        _log_ai("song", "elevenlabs", model, elevenlabs.EST_COST_SONG_USD, ok=ok, started=time.monotonic() - ms / 1000, error=err)

    path, _cached = get_or_make_song(prompt, seconds=tpl["duration_sec"], instrumental=bool(tpl.get("song_instrumental")), on_made=log_call)
    # gift-media is private, so hand JSON2Video a signed URL.
    return signed_url(MEDIA_BUCKET, path), 0


def _preview_video(tpl: dict, layout) -> str:
    s = get_settings()
    stamp = int(time.time())
    photos = sample_photos(tpl["photos_max"])  # worst case: the most scenes a user can make
    photo_urls = [
        public_url(TEMPLATE_BUCKET, upload_bytes(TEMPLATE_BUCKET, f"templates/{tpl['id']}/samples/{stamp}_{i}.jpg", data, "image/jpeg"))
        for i, data in enumerate(photos)
    ]
    audio_url, seek = _sample_song(tpl)
    headline, closing = split_video_prompt(fill(tpl.get("video_prompt") or "", name=SAMPLE_NAME, sender=SAMPLE_SENDER,
                                                fun_fact=SAMPLE_FUN_FACT, occasion=_category_name(tpl)))

    job = one(db().table("template_preview_jobs").insert({"template_id": tpl["id"]}).execute())
    webhook = f"{s.base_url}/webhooks/json2video?secret={s.webhook_secret}&job={job['id']}&type=template"
    body = movie_body(
        tpl, kind="preview", occasion=tpl["occasion"], recipient=SAMPLE_NAME, sender=SAMPLE_SENDER, fun_fact=SAMPLE_FUN_FACT,
        photo_urls=[u for u in photo_urls if u], audio_url=audio_url, audio_seek=seek, fade=True, lyric_lines=[],
        art_url=public_url(TEMPLATE_BUCKET, tpl["art_path"]), background_url=public_url(TEMPLATE_BUCKET, tpl.get("art_bg_path")),
        slot=layout.slots[0], watermark=False, webhook_url=webhook,
        client_data={"templateId": tpl["id"], "jobId": job["id"], "kind": "template-preview"}, headline=headline, closing=closing,
        song_json=tpl.get("song_json") if audio_url else None,
    )
    try:
        project = create_movie(body)
    except Exception as e:
        db().table("template_preview_jobs").update({"status": "error", "error": str(e)[:300], "finished_at": _now().isoformat()}).eq("id", job["id"]).execute()
        raise
    db().table("template_preview_jobs").update({"provider_project_id": project, "status": "running"}).eq("id", job["id"]).execute()
    return "rendering"


def on_template_preview_done(job_id: str, *, success: bool, video_url: str | None, error: str | None) -> str:
    job = one(db().table("template_preview_jobs").select("*").eq("id", job_id).execute())
    if not job or job["status"] in ("done", "error"):
        return "skipped"
    finished = {"finished_at": _now().isoformat()}
    tid = job["template_id"]
    if success and video_url:
        try:
            data = _download(video_url)
            path = upload_bytes(TEMPLATE_BUCKET, f"templates/{tid}/preview_{int(time.time())}.mp4", data, "video/mp4")
        except Exception as e:  # noqa: BLE001
            db().table("template_preview_jobs").update({"status": "error", "error": str(e)[:300], **finished}).eq("id", job_id).execute()
            _set(tid, preview_status="error", preview_error=f"Could not save the preview: {e}"[:300])
            return "error"
        db().table("template_preview_jobs").update({"status": "done", **finished}).eq("id", job_id).execute()
        _set(tid, preview_video_path=path, preview_url=public_url(TEMPLATE_BUCKET, path), preview_status="ready", preview_error=None)
        return "done"
    db().table("template_preview_jobs").update({"status": "error", "error": (error or "Render failed")[:300], **finished}).eq("id", job_id).execute()
    _set(tid, preview_status="error", preview_error=(error or "Render failed")[:300])
    return "error"


# ───────────────────────────────────────────────────────────── safety net (called from pipeline.sweep, every minute)
def sweep_templates() -> dict[str, int]:
    done = {"redispatched": 0, "timed_out": 0, "polled": 0}

    # queued but nobody picked it up (trigger missed) → start again
    for column, path in (("art_status", "art"), ("preview_status", "preview"), ("song_status", "song")):
        rows = db().table("templates").select("id").eq(column, "queued").lt("updated_at", _ago(REDISPATCH_AFTER)).limit(5).execute().data
        for r in rows:
            db().rpc("call_backend", {"p_path": f"/internal/templates/{r['id']}/{path}"}).execute()
            done["redispatched"] += 1

    # art stuck "running" (function died)
    for r in db().table("templates").select("id").eq("art_status", "running").lt("updated_at", _ago(STUCK_AFTER)).limit(10).execute().data:
        _set(r["id"], art_status="error", art_error="Timed out. Please try again.")
        done["timed_out"] += 1

    # song job stuck "running" (function died)
    for r in db().table("templates").select("id").eq("song_status", "running").lt("updated_at", _ago(STUCK_AFTER)).limit(10).execute().data:
        _set(r["id"], song_status="error", song_error="Timed out. Please try again.")
        done["timed_out"] += 1

    # preview stuck "running": video previews wait for JSON2Video, so ask it; others just time out
    for r in db().table("templates").select("id").eq("preview_status", "running").lt("updated_at", _ago(STUCK_AFTER)).limit(10).execute().data:
        job = one(db().table("template_preview_jobs").select("*").eq("template_id", r["id"]).in_("status", ["pending", "running"])
                  .order("created_at", desc=True).limit(1).execute())
        if not job or not job["provider_project_id"]:
            _set(r["id"], preview_status="error", preview_error="Timed out. Please try again.")
            done["timed_out"] += 1
            continue
        done["polled"] += 1
        try:
            movie = get_movie(job["provider_project_id"])
        except Exception:  # noqa: BLE001
            log.exception("status check failed for template job %s", job["id"])
            continue
        too_old = datetime.fromisoformat(job["created_at"]) < _now() - RENDER_TIMEOUT
        if movie.get("status") == "done":
            on_template_preview_done(job["id"], success=True, video_url=movie.get("url"), error=None)
        elif movie.get("status") == "error" or too_old:
            on_template_preview_done(job["id"], success=False, video_url=None, error=movie.get("message") or "Render timed out")
    return done
