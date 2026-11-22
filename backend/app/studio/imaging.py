"""Small Pillow helpers shared by the studio modules."""
import io
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

FONT_PATH = Path(__file__).resolve().parents[2] / "assets" / "fonts" / "Poppins-Bold.ttf"


def open_image(data: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)  # phone photos carry their rotation in EXIF
    return img.convert("RGB")


def cover_fit(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Scale + centre-crop so the image fills `size` exactly (like CSS object-fit: cover)."""
    return ImageOps.fit(img, size, method=Image.LANCZOS, centering=(0.5, 0.5))


def clamp_radius(radius: int, w: int, h: int) -> int:
    return max(0, min(radius, w // 2, h // 2))


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), clamp_radius(radius, *size), fill=255)
    return mask


@lru_cache(maxsize=16)
def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(str(FONT_PATH), size)
    except OSError:  # font file missing: still produce an image
        try:
            return ImageFont.load_default(size=size)
        except TypeError:
            return ImageFont.load_default()


def to_bytes(img: Image.Image, fmt: str, **kw) -> bytes:
    out = io.BytesIO()
    img.save(out, fmt, **kw)
    return out.getvalue()
