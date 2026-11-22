"""Pillow helpers for photo templates: small, watermarked preview + shrinking photos."""
import io

from PIL import Image, ImageDraw, ImageFont

PREVIEW_MAX = 720  # longest side of the free preview
INPUT_MAX = 1280   # longest side of shrunk photos
WATERMARK = "GEETZY · PREVIEW"


def shrink_photo(data: bytes, max_side: int = INPUT_MAX) -> bytes:
    """JPEG bytes, longest side <= max_side."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.thumbnail((max_side, max_side))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=88)
    return out.getvalue()


def make_preview(data: bytes) -> bytes:
    """Downscaled JPEG with a tiled diagonal watermark. The full-size file is only sent after payment."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.thumbnail((PREVIEW_MAX, PREVIEW_MAX))
    w, h = img.size
    size = max(14, w // 14)
    try:
        font = ImageFont.load_default(size=size)
    except TypeError:  # very old Pillow
        font = ImageFont.load_default()

    layer = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    step_y, step_x = size * 3, size * 11
    for row, y in enumerate(range(0, h * 2, step_y)):
        for x in range(-step_x if row % 2 else 0, w * 2, step_x):
            draw.text((x, y), WATERMARK, font=font, fill=(255, 255, 255, 90))
    layer = layer.rotate(25, resample=Image.BICUBIC).crop((w // 2, h // 2, w // 2 + w, h // 2 + h))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")

    out = io.BytesIO()
    img.save(out, "JPEG", quality=82)
    return out.getvalue()
