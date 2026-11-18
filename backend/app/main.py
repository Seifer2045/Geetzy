"""Geetzy API — FastAPI on Vercel, data in Supabase.

Local:   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   (reads backend/.env)
Vercel:  auto-detected entrypoint app/main.py (see vercel.json for the time limit)
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Body, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError

from . import pipeline
from .ai.gemini import EST_COST_LYRICS_USD, GeminiError, write_lyrics
from .auth import AuthUser, check_webhook_secret, current_user, require_internal
from .config import get_settings
from .db import MEDIA_BUCKET, UPLOADS_BUCKET, db, one, remove_folder, signed_url
from .schemas import (
    AiSong,
    CreateGiftInput,
    Gift,
    LibraryItem,
    LyricsInput,
    Occasion,
    Template,
    TemplateStyle,
    VerifyPaymentInput,
)

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Geetzy API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

TEMPLATE_SELECT = "*, price_tiers(price_inr)"
GIFT_SELECT = "*, templates(name, color_from, color_to)"


# ───────────────────────────────────────────────────────────── mapping DB rows → API contract
def _template(row: dict) -> Template:
    return Template(
        id=row["id"], name=row["name"], occasion=row["occasion"], style=row["style"],
        price=row["price_tiers"]["price_inr"], original_price=row["original_price_inr"],
        duration_sec=row["duration_sec"], photos_min=row["photos_min"], photos_max=row["photos_max"],
        made_count=row["made_count"], description=row["description"], tags=row["tags"],
        colors=(row["color_from"], row["color_to"]), preview_url=row["preview_url"], trending=row["trending"],
    )


def _gift(row: dict) -> Gift:
    t = row["templates"]
    paid = row["status"] == "paid"
    return Gift(
        id=row["id"], template_id=row["template_id"], template_name=t["name"], occasion=row["occasion"],
        recipient_name=row["recipient_name"], sender_name=row["sender_name"], status=row["status"],
        progress=row["progress"], created_at=row["created_at"],
        preview_url=signed_url(MEDIA_BUCKET, row["preview_path"]),
        hd_url=signed_url(MEDIA_BUCKET, row["hd_path"]) if paid else None,
        colors=(t["color_from"], t["color_to"]), price=row["price_inr"],
    )


def _own_gift(gift_id: str, user: AuthUser) -> dict:
    row = one(db().table("gifts").select(GIFT_SELECT).eq("id", gift_id).eq("user_id", user.id).is_("deleted_at", "null").execute())
    if not row:
        raise HTTPException(404, "Gift not found")
    return row


def _check_own_path(path: str, user: AuthUser) -> str:
    if not path.startswith(f"{user.id}/") or ".." in path:
        raise HTTPException(400, "Invalid file path")
    return path


# ───────────────────────────────────────────────────────────── public
@app.get("/")
def root():
    return {"name": "Geetzy API", "health": "/health", "docs": "/docs"}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/templates", response_model=list[Template], response_model_by_alias=True)
def list_templates(occasion: Optional[Occasion] = None, style: Optional[TemplateStyle] = None, q: Optional[str] = None):
    query = db().table("templates").select(TEMPLATE_SELECT).eq("is_active", True).order("sort_order")
    if occasion:
        query = query.eq("occasion", occasion)
    if style:
        query = query.eq("style", style)
    rows = query.execute().data
    ql = (q or "").strip().lower()
    return [_template(r) for r in rows
            if not ql or ql in r["name"].lower() or any(ql in tag.lower() for tag in r["tags"])]


@app.get("/templates/{tid}", response_model=Template, response_model_by_alias=True)
def get_template(tid: str):
    row = one(db().table("templates").select(TEMPLATE_SELECT).eq("id", tid).eq("is_active", True).execute())
    if not row:
        raise HTTPException(404, f"Template {tid} not found")
    return _template(row)


# ───────────────────────────────────────────────────────────── signed-in user
@app.post("/lyrics", response_model=AiSong, response_model_by_alias=True)
def generate_lyrics(body: LyricsInput, user: AuthUser = Depends(current_user)):
    s = get_settings()
    tpl = one(db().table("templates").select("occasion").eq("id", body.template_id).execute())
    if not tpl:
        raise HTTPException(404, "Template not found")
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    used = db().table("ai_requests").select("id", count="exact", head=True) \
        .eq("user_id", user.id).eq("kind", "lyrics").gte("created_at", since).execute().count or 0
    if used >= s.lyrics_per_day:
        raise HTTPException(429, "You've made a lot of songs today. Please try again tomorrow.")
    try:
        res = write_lyrics(occasion=tpl["occasion"], name=body.recipient_name.strip(), fun_fact=body.fun_fact,
                           mood=body.mood, version=body.version)
    except GeminiError as e:
        logging.getLogger("geetzy").warning("lyrics failed: %s", e)
        raise HTTPException(502, "Could not write the lyrics. Please try again.")
    db().table("ai_requests").insert({"user_id": user.id, "kind": "lyrics", "model": s.gemini_text_model,
                                      "est_cost_usd": EST_COST_LYRICS_USD}).execute()
    return AiSong(title=res.title, lyrics=res.lyrics, retries_left=max(0, s.lyrics_per_day - used - 1))


@app.post("/gifts", response_model=Gift, response_model_by_alias=True)
def create_gift(body: CreateGiftInput, user: AuthUser = Depends(current_user)):
    photos = [_check_own_path(p, user) for p in body.photo_paths]
    if body.song.type == "ai":
        song = {"source": "ai", "mood": body.song.mood, "singer": body.song.singer,
                "version": body.song.version, "lyrics": body.song.lyrics.strip()}
    else:
        song = {"source": "upload", "upload_path": _check_own_path(body.song.storage_path, user),
                "upload_file_name": body.song.file_name, "upload_duration_sec": body.song.duration_sec,
                "trim_start_sec": body.song.trim_start_sec, "fade": body.song.fade}
    try:
        created = db().rpc("create_gift", {
            "p_user_id": user.id, "p_template_id": body.template_id,
            "p_recipient_name": body.recipient_name.strip(), "p_sender_name": body.sender_name.strip(),
            "p_fun_fact": body.fun_fact.strip(), "p_photo_paths": photos, "p_song": song,
        }).execute().data
    except APIError as e:
        msg = e.message or ""
        if "template_not_found" in msg:
            raise HTTPException(404, "Template not found")
        if "photo_count" in msg:
            raise HTTPException(422, "Please add the right number of photos for this template.")
        raise
    gift_id = created["id"] if isinstance(created, dict) else created[0]["id"]
    # Work starts from the database trigger (pg_net → /internal/gifts/{id}/run).
    return _gift(_own_gift(gift_id, user))


@app.get("/gifts/{gid}", response_model=Gift, response_model_by_alias=True)
def get_gift(gid: str, user: AuthUser = Depends(current_user)):
    return _gift(_own_gift(gid, user))


@app.post("/payments/verify", response_model=Gift, response_model_by_alias=True)
def verify_payment(body: VerifyPaymentInput, user: AuthUser = Depends(current_user)):
    row = _own_gift(body.gift_id, user)
    if row["status"] == "paid":
        return _gift(row)
    if row["status"] != "preview_ready":
        raise HTTPException(409, "The video is not ready yet.")
    if not get_settings().allow_fake_payments:
        # TODO: verify body.purchase_token with the Google Play Developer API.
        raise HTTPException(501, "Payments are not set up yet.")
    pipeline.mark_paid(row, provider="fake", purchase_token=body.purchase_token)
    return _gift(_own_gift(body.gift_id, user))


@app.get("/library", response_model=list[LibraryItem], response_model_by_alias=True)
def library(user: AuthUser = Depends(current_user)):
    rows = db().table("gifts").select(GIFT_SELECT).eq("user_id", user.id).is_("deleted_at", "null") \
        .order("created_at", desc=True).limit(100).execute().data
    items = []
    for r in rows:
        status = "hd" if r["status"] == "paid" else "preview" if r["status"] == "preview_ready" else "making"
        items.append(LibraryItem(
            id=f"LIB-{r['code']}", kind="video", title=f"For {r['recipient_name']}",
            subtitle=f"{r['occasion'].title()} · {r['templates']['name']}", status=status,
            progress=r["progress"], colors=(r["templates"]["color_from"], r["templates"]["color_to"]),
            gift_id=r["id"], created_at=r["created_at"],
        ))
    return items


@app.delete("/me")
def delete_account(user: AuthUser = Depends(current_user)):
    """Deletes the user's files, then the auth user (all rows cascade)."""
    for bucket in (UPLOADS_BUCKET, MEDIA_BUCKET):
        remove_folder(bucket, user.id)
    db().auth.admin.delete_user(user.id)
    return {"ok": True}


# ───────────────────────────────────────────────────────────── called by Supabase / JSON2Video
@app.post("/internal/gifts/{gid}/run", dependencies=[Depends(require_internal)])
def internal_run(gid: str):
    return {"result": pipeline.run_gift(gid)}


@app.post("/internal/sweep", dependencies=[Depends(require_internal)])
def internal_sweep():
    return pipeline.sweep()


@app.post("/webhooks/json2video")
def json2video_webhook(secret: str, job: str, payload: dict[str, Any] = Body(default_factory=dict)):
    check_webhook_secret(secret)
    if payload.get("test"):
        return {"ok": True}
    result = pipeline.on_render_done(
        job, success=bool(payload.get("success")), video_url=payload.get("url"), error=payload.get("error"),
    )
    return {"result": result}
