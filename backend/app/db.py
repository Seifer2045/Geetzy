"""Supabase access with the secret key (bypasses RLS). Server only."""
from functools import lru_cache
from typing import Any

from supabase import Client, create_client

from .config import get_settings

UPLOADS_BUCKET = "gift-uploads"  # written by the app (photos, own songs)
MEDIA_BUCKET = "gift-media"  # written by the backend (Lyria songs, videos)
TEMPLATE_BUCKET = "template-media"  # PUBLIC: template art, previews, sample photos (written by the studio jobs)
SIGNED_URL_SECONDS = 60 * 60


@lru_cache
def db() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_secret_key)


def one(rows: Any) -> dict | None:
    data = rows.data if hasattr(rows, "data") else rows
    if isinstance(data, list):
        return data[0] if data else None
    return data


def signed_url(bucket: str, path: str | None, seconds: int = SIGNED_URL_SECONDS) -> str | None:
    if not path:
        return None
    res = db().storage.from_(bucket).create_signed_url(path, seconds)
    return res.get("signedURL") or res.get("signedUrl")


def upload_bytes(bucket: str, path: str, data: bytes, content_type: str) -> str:
    db().storage.from_(bucket).upload(path, data, {"content-type": content_type, "upsert": "true"})
    return path


def remove_folder(bucket: str, prefix: str) -> None:
    """Deletes every file under prefix/ (two levels deep is enough for our layout)."""
    store = db().storage.from_(bucket)
    paths: list[str] = []
    for entry in store.list(prefix, {"limit": 1000}):
        name = f"{prefix}/{entry['name']}"
        if entry.get("id"):  # a file
            paths.append(name)
        else:  # a folder
            paths.extend(f"{name}/{f['name']}" for f in store.list(name, {"limit": 1000}) if f.get("id"))
    for i in range(0, len(paths), 100):
        store.remove(paths[i : i + 100])


def public_url(bucket: str, path: str | None) -> str | None:
    """URL of a file in a PUBLIC bucket (template-media). Never use for private buckets."""
    if not path:
        return None
    return f"{get_settings().supabase_url}/storage/v1/object/public/{bucket}/{path}"
