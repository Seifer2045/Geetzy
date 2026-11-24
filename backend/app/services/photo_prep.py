"""Cuts every user photo for the frames it is shown in (face placed well), before the video is rendered.

Per gift: each photo is downloaded ONCE, faces are detected ONCE, and one JPEG is made per distinct frame
(`{user}/{gift}/clean/{k}-{w}x{h}.jpg` in gift-media). The path is fixed, so the HD render and any retry reuse the files
and never redo the work. Anything that fails falls back, in this order, to: a clean full copy of the photo, then the
original upload. A gift is never blocked because a photo could not be cut.
"""
import io
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

import httpx
from PIL import Image, ImageOps

from ..db import MEDIA_BUCKET, UPLOADS_BUCKET, signed_url, upload_bytes
from ..video import faces as face_finder
from ..video import framing

log = logging.getLogger("geetzy.photo_prep")
WORKERS = 4


@dataclass
class PreparedPhotos:
    urls: list[str]                                              # one per photo: the best plain version (clean copy or original)
    variants: dict[str, str] = field(default_factory=dict)       # "{k}:{w}x{h}" -> url of the cut made for that frame


def _existing(path: str) -> str | None:
    """Signed URL of a file that is already stored, else None (create_signed_url raises for a missing file)."""
    try:
        return signed_url(MEDIA_BUCKET, path)
    except Exception:  # noqa: BLE001 — not there yet
        return None


def _load(url: str) -> Image.Image:
    r = httpx.get(url, timeout=60)
    r.raise_for_status()
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(r.content)))
    img.load()
    return img.convert("RGB")


def _prepare_one(base: str, k: int, original_url: str, frames: set[tuple[int, int]]) -> tuple[str, dict[str, str]]:
    plain_path = f"{base}/clean/{k}.jpg"
    variants: dict[str, str] = {}
    todo = []
    for w, h in sorted(frames):
        path = f"{base}/clean/{k}-{w}x{h}.jpg"
        url = _existing(path)
        if url:
            variants[f"{k}:{w}x{h}"] = url
        else:
            todo.append((w, h, path))
    plain = _existing(plain_path)
    if not todo and plain:
        return plain, variants
    try:
        img = _load(original_url)
    except Exception:  # noqa: BLE001 — the upload cannot be read: JSON2Video gets the original and reports it
        log.exception("photo %s could not be opened", k)
        return plain or original_url, variants
    if not plain:
        try:
            upload_bytes(MEDIA_BUCKET, plain_path, framing.plain_jpeg(img), "image/jpeg")
            plain = signed_url(MEDIA_BUCKET, plain_path)
        except Exception:  # noqa: BLE001
            log.exception("clean copy of photo %s failed", k)
    faces = face_finder.find_faces(img) if todo else []
    for w, h, path in todo:
        try:
            upload_bytes(MEDIA_BUCKET, path, framing.render_variant(img, (w, h), faces), "image/jpeg")
            url = signed_url(MEDIA_BUCKET, path)
            if url:
                variants[f"{k}:{w}x{h}"] = url
        except Exception:  # noqa: BLE001 — this frame falls back to the plain photo
            log.exception("cut %sx%s of photo %s failed", w, h, k)
    return plain or original_url, variants


def prepare_photos(user_id: str, gift_id: str, storage_paths: list[str], frames: dict[int, set[tuple[int, int]]]) -> PreparedPhotos:
    """`storage_paths` are the gift's uploads in order (photo 1 first). `frames` = photo number -> HD frame sizes."""
    base = f"{user_id}/{gift_id}"
    originals = [signed_url(UPLOADS_BUCKET, p) for p in storage_paths]
    jobs = [(k, url) for k, url in enumerate(originals, start=1) if url]
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(lambda job: _prepare_one(base, job[0], job[1], frames.get(job[0], set())), jobs))
    urls = [r[0] for r in results]
    variants: dict[str, str] = {}
    for _, v in results:
        variants.update(v)
    return PreparedPhotos(urls=urls, variants=variants)
