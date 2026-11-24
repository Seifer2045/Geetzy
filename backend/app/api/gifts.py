"""Signed-in user: create a gift, read it, library, delete account."""
from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from ..auth import AuthUser, current_user
from ..db import MEDIA_BUCKET, UPLOADS_BUCKET, db, one, remove_folder
from ..schemas import CreateGiftInput, Gift, LibraryItem
from ..services.song_draft import approved_draft
from .common import GIFT_SELECT, check_own_path, ensure_active, own_gift, to_gift

router = APIRouter()


@router.post("/gifts", response_model=Gift, response_model_by_alias=True)
def create_gift(body: CreateGiftInput, user: AuthUser = Depends(current_user)):
    ensure_active(user)
    photos = [check_own_path(p, user) for p in body.photo_paths]
    tpl = one(db().table("templates").select("song_mode, duration_sec").eq("id", body.template_id)
              .eq("is_active", True).eq("status", "published").execute())
    if not tpl:
        raise HTTPException(404, "Template not found")
    mode = tpl["song_mode"]
    song: dict | None
    if mode in ("none", "fixed"):
        song = None  # photo templates, silent videos, and videos with the template's own song
    elif body.song is None:
        raise HTTPException(422, "Please choose a song for this template.")
    elif body.song.type == "ai":
        if mode == "upload":
            raise HTTPException(422, "This template needs your own song.")
        song = {"source": "ai", "mood": body.song.mood, "singer": body.song.singer,
                "version": body.song.version, "lyrics": body.song.lyrics.strip(), "prefs": body.song.prefs.model_dump()}
        if body.song.draft_id:  # the song the user already heard and approved: the video reuses it, no second ElevenLabs call
            song["audio_path"] = approved_draft(user.id, body.song.draft_id)["audio_path"]
    else:
        if mode == "ai":
            raise HTTPException(422, "This template uses an AI song.")
        # The video only uses `duration_sec` of the song, so the chosen window must fit inside the file.
        if body.song.trim_start_sec + tpl["duration_sec"] > body.song.duration_sec + 0.5:
            raise HTTPException(422, "Please pick a part of the song that is long enough.")
        song = {"source": "upload", "upload_path": check_own_path(body.song.storage_path, user),
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
        if "blocked" in msg:
            raise HTTPException(403, "This account is blocked. Please contact support.")
        if "photo_count" in msg:
            raise HTTPException(422, "Please add the right number of photos for this template.")
        raise
    gift_id = created["id"] if isinstance(created, dict) else created[0]["id"]
    # Work starts from the database trigger (pg_net → /internal/gifts/{id}/run).
    return to_gift(own_gift(gift_id, user))


@router.get("/gifts/{gid}", response_model=Gift, response_model_by_alias=True)
def get_gift(gid: str, user: AuthUser = Depends(current_user)):
    return to_gift(own_gift(gid, user))


@router.get("/library", response_model=list[LibraryItem], response_model_by_alias=True)
def library(user: AuthUser = Depends(current_user)):
    rows = db().table("gifts").select(GIFT_SELECT).eq("user_id", user.id).is_("deleted_at", "null") \
        .order("created_at", desc=True).limit(100).execute().data
    items = []
    for r in rows:
        is_image = r["templates"].get("output_type") == "image"
        status = ("hd" if r["status"] == "paid" else "preview" if r["status"] == "preview_ready"
                  else "failed" if r["status"] == "failed" else "making")
        if is_image and status not in ("making", "failed"):
            status = "photo"
        items.append(LibraryItem(
            id=f"LIB-{r['code']}", kind="photo" if is_image else "video", title=f"For {r['recipient_name']}",
            subtitle=f"{r['occasion'].title()} · {r['templates']['name']}", status=status,
            progress=r["progress"], colors=(r["templates"]["color_from"], r["templates"]["color_to"]),
            gift_id=r["id"], created_at=r["created_at"],
        ))
    return items


@router.delete("/me")
def delete_account(user: AuthUser = Depends(current_user)):
    """Deletes the user's files, then the auth user (all rows cascade)."""
    for bucket in (UPLOADS_BUCKET, MEDIA_BUCKET):
        remove_folder(bucket, user.id)
    db().auth.admin.delete_user(user.id)
    return {"ok": True}
