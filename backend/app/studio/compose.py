"""Photo templates: the user's photos pasted into the layout's slots on the template art, plus names as text.

No AI call per user: this is plain Pillow, so a photo template costs ~nothing to generate.
"""
from PIL import Image, ImageDraw, ImageFilter

from ..video.json2video import HEADLINE
from .imaging import cover_fit, font, open_image, rounded_mask, to_bytes
from .layouts import CANVAS, Slot

BORDER = 10
SHADOW_PAD = 44


def _tile(photo: Image.Image, slot: Slot, size: tuple[int, int]) -> Image.Image:
    """Photo cropped to the slot, rounded, white border, soft shadow, rotated — ready to paste at the slot centre."""
    _, _, w, h = slot.px(size)
    r = slot.radius_px(size)
    inner = cover_fit(photo, (w, h)).convert("RGBA")
    tile = Image.new("RGBA", (w + 2 * BORDER, h + 2 * BORDER), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle((0, 0, tile.width - 1, tile.height - 1), r + BORDER, fill=(255, 255, 255, 255))
    tile.paste(inner, (BORDER, BORDER), rounded_mask((w, h), r))

    layer = Image.new("RGBA", (tile.width + 2 * SHADOW_PAD, tile.height + 2 * SHADOW_PAD), (0, 0, 0, 0))
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 140), (SHADOW_PAD, SHADOW_PAD + 12), tile.getchannel("A"))
    layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(16)))
    layer.alpha_composite(tile, (SHADOW_PAD, SHADOW_PAD))
    if slot.rotate:
        layer = layer.rotate(-slot.rotate, resample=Image.BICUBIC, expand=True)
    return layer


def _fit_text(draw: ImageDraw.ImageDraw, text: str, max_w: int, start: int, floor: int = 28):
    size = start
    while size > floor:
        f = font(size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 4
    return font(floor)


def _centered(draw: ImageDraw.ImageDraw, canvas_w: int, y: int, text: str, f, fill=(255, 255, 255, 255)) -> None:
    x = (canvas_w - draw.textlength(text, font=f)) / 2
    draw.text((x + 3, y + 4), text, font=f, fill=(0, 0, 0, 150))  # soft drop shadow
    draw.text((x, y), text, font=f, fill=fill)


def compose_image(
    bg_bytes: bytes, slots: tuple[Slot, ...] | list[Slot], photos: list[bytes], *,
    recipient: str, sender: str, occasion: str, size: tuple[int, int] = CANVAS,
) -> bytes:
    """Full-size JPEG (9:16). If there are fewer photos than slots the photos repeat."""
    if not photos:
        raise ValueError("At least one photo is needed")
    W, H = size
    canvas = cover_fit(open_image(bg_bytes), size).convert("RGBA")
    images = [open_image(p) for p in photos]

    for i, slot in enumerate(slots):
        tile = _tile(images[i % len(images)], slot, size)
        left, top, w, h = slot.px(size)
        cx, cy = left + w // 2, top + h // 2
        canvas.paste(tile, (cx - tile.width // 2, cy - tile.height // 2), tile)

    draw = ImageDraw.Draw(canvas)
    headline = HEADLINE.get(occasion, "For {name}").format(name=recipient)
    _centered(draw, W, int(H * 0.855), headline, _fit_text(draw, headline, int(W * 0.9), 92))
    signoff = f"With love, {sender}"
    _centered(draw, W, int(H * 0.935), signoff, _fit_text(draw, signoff, int(W * 0.8), 56), fill=(255, 255, 255, 235))
    return to_bytes(canvas.convert("RGB"), "JPEG", quality=92)
