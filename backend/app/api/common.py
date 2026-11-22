"""Shared helpers for the routers: DB row → API contract mapping, ownership checks."""
from fastapi import HTTPException

from ..auth import AuthUser
from ..config import get_settings
from ..db import MEDIA_BUCKET, db, one, signed_url
from ..schemas import Gift, Template
from ..services.pricing import effective_price

TEMPLATE_SELECT = "*, price_tiers(price_inr), categories(slug)"
GIFT_SELECT = "*, templates(name, color_from, color_to, output_type)"
TEMPLATE_MEDIA_BUCKET = "template-media"  # public bucket, written by the admin dashboard


def template_media_url(path: str | None) -> str | None:
    if not path:
        return None
    return f"{get_settings().supabase_url}/storage/v1/object/public/{TEMPLATE_MEDIA_BUCKET}/{path}"


def to_template(row: dict) -> Template:
    # 'fixed' (the template's own song) looks like 'none' to the app: it just skips the song step.
    song_mode = row.get("song_mode") or "both"
    return Template(
        id=row["id"], name=row["name"], occasion=row["occasion"], style=row["style"],
        price=effective_price(row), original_price=row["original_price_inr"],
        duration_sec=row["duration_sec"], photos_min=row["photos_min"], photos_max=row["photos_max"],
        made_count=row["made_count"], description=row["description"], tags=row["tags"],
        colors=(row["color_from"], row["color_to"]), preview_url=row["preview_url"], trending=row["trending"],
        category_id=row.get("category_id"), category=(row.get("categories") or {}).get("slug"),
        orientation=row.get("orientation") or "vertical", output_type=row.get("output_type") or "song_video",
        song_mode="none" if song_mode == "fixed" else song_mode, thumb_url=template_media_url(row.get("thumb_path")),
        preview_type="image" if row.get("output_type") == "image" else "video",
    )


def to_gift(row: dict) -> Gift:
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


def own_gift(gift_id: str, user: AuthUser) -> dict:
    row = one(db().table("gifts").select(GIFT_SELECT).eq("id", gift_id).eq("user_id", user.id).is_("deleted_at", "null").execute())
    if not row:
        raise HTTPException(404, "Gift not found")
    return row


def ensure_active(user: AuthUser) -> None:
    """Admin-blocked accounts cannot make or pay for anything."""
    row = one(db().table("profiles").select("blocked_at").eq("id", user.id).execute())
    if row and row["blocked_at"]:
        raise HTTPException(403, "This account is blocked. Please contact support.")


def check_own_path(path: str, user: AuthUser) -> str:
    if not path.startswith(f"{user.id}/") or ".." in path:
        raise HTTPException(400, "Invalid file path")
    return path
