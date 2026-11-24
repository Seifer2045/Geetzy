"""Template art: the admin's uploaded background + OUR frame overlay.

An uploaded picture can't have a photo-sized hole, so we draw the frame (shadow + white border) from the layout
ourselves and cut a transparent hole. Photos placed *under* the overlay therefore always fit the slot, with
rounded corners, whatever the background looks like.
"""
from PIL import Image, ImageChops, ImageDraw, ImageFilter

from .imaging import clamp_radius, cover_fit, open_image, to_bytes
from .layouts import CANVAS, Slot

BORDER = 12
SHADOW_BLUR = 18
SHADOW_OFFSET = 14

def frame_overlay(bg_bytes: bytes, slots: tuple[Slot, ...] | list[Slot], size: tuple[int, int] = CANVAS) -> bytes:
    """PNG (RGBA): the background with a framed, fully transparent hole at every slot."""
    return _overlay(cover_fit(open_image(bg_bytes), size).convert("RGBA"), slots, size)


def frame_only(slots: tuple[Slot, ...] | list[Slot], size: tuple[int, int] = CANVAS) -> bytes:
    """PNG (RGBA): ONLY the frame (white border + shadow) around every slot, everything else transparent.
    Used on top of a template's background video, which supplies the decoration itself."""
    return _overlay(Image.new("RGBA", size, (0, 0, 0, 0)), slots, size)


def _overlay(bg: Image.Image, slots: tuple[Slot, ...] | list[Slot], size: tuple[int, int]) -> bytes:
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    ring = Image.new("RGBA", size, (0, 0, 0, 0))
    hole = Image.new("L", size, 0)
    sd, rd, hd = ImageDraw.Draw(shadow), ImageDraw.Draw(ring), ImageDraw.Draw(hole)

    for s in slots:
        left, top, w, h = s.px(size)
        r = s.radius_px(size)
        outer = (left - BORDER, top - BORDER, left + w + BORDER, top + h + BORDER)
        ro = clamp_radius(r + BORDER, w + 2 * BORDER, h + 2 * BORDER)
        sd.rounded_rectangle((outer[0], outer[1] + SHADOW_OFFSET, outer[2], outer[3] + SHADOW_OFFSET), ro, fill=(0, 0, 0, 150))
        rd.rounded_rectangle(outer, ro, fill=(255, 255, 255, 255))
        hd.rounded_rectangle((left, top, left + w - 1, top + h - 1), clamp_radius(r, w, h), fill=255)

    shadow = shadow.filter(ImageFilter.GaussianBlur(SHADOW_BLUR))
    out = Image.alpha_composite(Image.alpha_composite(bg, shadow), ring)
    out.putalpha(ImageChops.multiply(out.getchannel("A"), ImageChops.invert(hole)))
    return to_bytes(out, "PNG", optimize=True)


def background_jpeg(bg_bytes: bytes, size: tuple[int, int] = CANVAS) -> bytes:
    """The uploaded background normalised to exactly 9:16 (so the app and admin always get the right ratio)."""
    return to_bytes(cover_fit(open_image(bg_bytes), size), "JPEG", quality=92)


def _rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def gradient_background(color_from: str, color_to: str, size: tuple[int, int] = CANVAS) -> bytes:
    """Free fallback when the admin uploads no background: a soft top-to-bottom gradient in the template colours."""
    w, h = size
    top, bottom = _rgb(color_from), _rgb(color_to)
    column = Image.new("RGB", (1, h))
    column.putdata([tuple(round(top[c] + (bottom[c] - top[c]) * y / (h - 1)) for c in range(3)) for y in range(h)])
    return to_bytes(column.resize((w, h)), "JPEG", quality=92)
