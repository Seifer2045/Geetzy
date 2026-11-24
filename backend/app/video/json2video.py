"""JSON2Video: builds the movie JSON for a gift and talks to the API.

Docs: https://json2video.com/docs/v2 — create `POST /v2/movies`, status `GET /v2/movies?project=`.
Billing is 1 credit per second of output, so a 15 s video costs 15 credits (preview and HD each).
"""
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx

from ..config import get_settings
from ..studio.layouts import Slot

API = "https://api.json2video.com/v2/movies"
TRANSITION_SEC = 0.6
SIZES = {"preview": (540, 960), "hd": (1080, 1920)}  # vertical 9:16 for WhatsApp Status / Reels
HORIZONTAL_SIZES = {"preview": (960, 540), "hd": (1920, 1080)}  # 16:9
HORIZONTAL_TEXT_SCALE = 0.55  # vw units are relative to the (wider) width, so text shrinks
PANS = ["right", "left", "top", "bottom"]

HEADLINE = {
    "birthday": "Happy Birthday, {name}!",
    "anniversary": "Happy Anniversary, {name}!",
    "apology": "Sorry na, {name}!",
    "festival": "Happy Festival, {name}!",
}
STYLE_DEFAULTS: dict[str, dict[str, str]] = {
    "bollywood": {"font": "Playfair Display", "transition": "fadewhite", "textStyle": "003"},
    "retro": {"font": "VT323", "transition": "pixelize", "textStyle": "004"},
    "genz": {"font": "Poppins", "transition": "slideleft", "textStyle": "005"},
}

RenderKind = Literal["preview", "hd"]


class Json2VideoError(RuntimeError):
    pass


@dataclass(frozen=True)
class MovieInput:
    kind: RenderKind
    occasion: str
    style: str
    recipient_name: str
    sender_name: str
    photo_urls: list[str]
    audio_url: str | None = None  # None = silent video (template song mode "none")
    audio_seek: float = 0.0
    fade: bool = True
    lyric_lines: list[str] = field(default_factory=list)
    color_from: str = "#FF4D8D"
    color_to: str = "#0A0A0F"
    render_config: dict[str, Any] = field(default_factory=dict)
    duration_sec: int = 15
    orientation: Literal["vertical", "horizontal"] = "vertical"
    # Template Studio "slot mode": photos sit in `slot`, the art PNG (transparent hole) is laid over them.
    art_url: str | None = None
    slot: Slot | None = None
    watermark: bool = True  # False for the admin's template preview
    # Admin's "video prompt", already filled with the names: line 1 = opening headline, line 2 = closing caption.
    headline: str = ""
    closing: str = ""
    # Photos cut for their frame (services/photo_prep.py): key "{photo number}:{w}x{h}" at HD size -> url.
    photo_variants: dict[str, str] = field(default_factory=dict)


def builtin_frames(
    n_photos: int, *, orientation: str = "vertical", art_url: str | None = None, slot: Slot | None = None,
) -> dict[int, set[tuple[int, int]]]:
    """Frame size (HD pixels) of every photo in the built-in design; the same decision `build_movie` makes below."""
    width, height = (HORIZONTAL_SIZES if orientation == "horizontal" else SIZES)["hd"]
    if art_url and slot:
        _, _, w, h = slot.px((width, height))
        frame = (w, h)
    else:
        frame = (width, height)
    return {k: {frame} for k in range(1, n_photos + 1)}


def _variant(m: "MovieInput", k: int, frame: tuple[int, int]) -> str:
    """The cut of photo k for this frame (frame measured at HD size), else the plain photo."""
    return m.photo_variants.get(f"{k}:{frame[0]}x{frame[1]}") or m.photo_urls[k - 1]


def _text(text: str, *, font: str, size_vw: float, y: int, w: int, h: int, style: str, color: str = "#FFFFFF") -> dict:
    return {
        "type": "text",
        "text": text,
        "style": style,
        "position": "custom",
        "x": 0,
        "y": y,
        "width": w,
        "height": h,
        "settings": {
            "font-family": font,
            "font-size": f"{size_vw}vw",
            "font-weight": "800",
            "color": color,
            "text-align": "center",
            "horizontal-position": "center",
            "vertical-position": "center",
            "text-shadow": "0 4px 18px rgba(0,0,0,0.65)",
        },
    }


def build_movie(m: MovieInput, *, webhook_url: str, client_data: dict[str, str]) -> dict:
    if not m.photo_urls:
        raise ValueError("At least one photo is needed")
    horizontal = m.orientation == "horizontal"
    width, height = (HORIZONTAL_SIZES if horizontal else SIZES)[m.kind]
    k = HORIZONTAL_TEXT_SCALE if horizontal else 1.0
    cfg = {**STYLE_DEFAULTS.get(m.style, STYLE_DEFAULTS["bollywood"]), **m.render_config}
    font, transition, text_style = cfg["font"], cfg["transition"], cfg["textStyle"]

    n = len(m.photo_urls)
    # Transitions overlap scenes, so each scene is a bit longer to keep the total at duration_sec.
    scene_sec = round((m.duration_sec + (n - 1) * TRANSITION_SEC) / n, 3)
    caption_box_h = int(height * (0.3 if horizontal else 0.28))
    caption_y = int(height * (0.66 if horizontal else 0.62))

    slot_mode = bool(m.art_url and m.slot)
    hd_frames = builtin_frames(n, orientation=m.orientation, art_url=m.art_url, slot=m.slot)
    scenes = []
    for i, url in enumerate(m.photo_urls):
        url = _variant(m, i + 1, next(iter(hd_frames[i + 1])))
        if slot_mode:
            left, top, slot_w, slot_h = m.slot.px((width, height))  # type: ignore[union-attr]
            photo: dict = {
                "type": "image", "src": url, "position": "custom",
                "x": left, "y": top, "width": slot_w, "height": slot_h,
                "zoom": 2, "duration": -2, "z-index": 1,
            }
        else:
            photo = {
                "type": "image", "src": url, "resize": "cover", "position": "center-center",
                "zoom": 2, "duration": -2,
            }
        elements: list[dict] = [photo]
        if i == 0:
            headline = m.headline or HEADLINE.get(m.occasion, "For {name}").format(name=m.recipient_name)
            elements.append(_text(headline, font=font, size_vw=9 * k, y=caption_y, w=width, h=caption_box_h, style=text_style))
        elif i == n - 1:
            closing = m.closing or f"With love, {m.sender_name}"
            elements.append(_text(closing, font=font, size_vw=7 * k, y=caption_y, w=width, h=caption_box_h, style="002"))
        elif i - 1 < len(m.lyric_lines):
            elements.append(_text(m.lyric_lines[i - 1], font=font, size_vw=6 * k, y=caption_y, w=width, h=caption_box_h, style="002"))

        if slot_mode:  # captions above the art overlay
            for el in elements:
                if el["type"] == "text":
                    el["z-index"] = 20
        scene: dict[str, Any] = {"background-color": m.color_to, "duration": scene_sec, "elements": elements}
        if i > 0:
            scene["transition"] = {"style": transition, "duration": TRANSITION_SEC}
        scenes.append(scene)

    movie_elements: list[dict] = []
    if m.audio_url:
        movie_elements.append({
            "type": "audio",
            "src": m.audio_url,
            "seek": round(m.audio_seek, 2),  # skip into the song (own song trim)
            "duration": m.duration_sec,
            "fade-in": 0.3 if m.fade and m.audio_seek > 0 else 0,
            "fade-out": 1.2 if m.fade else 0,
        })
    if slot_mode:
        movie_elements.append({
            "type": "image", "src": m.art_url, "resize": "cover", "position": "center-center",
            "width": width, "height": height, "duration": -2, "z-index": 10,
        })
    if m.kind == "preview" and m.watermark:
        movie_elements.append(
            _text("GEETZY · PREVIEW", font="Poppins", size_vw=8 * k, y=int(height * 0.08), w=width, h=int(height * 0.1),
                  style="001", color="rgba(255,255,255,0.45)") | {"duration": -2, "z-index": 50}
        )

    return {
        "resolution": "custom",
        "width": width,
        "height": height,
        "quality": "high" if m.kind == "hd" else "medium",
        "cache": True,
        "client-data": client_data,
        "scenes": scenes,
        "elements": movie_elements,
        "exports": [{"destinations": [{"type": "webhook", "endpoint": webhook_url}]}],
    }


def split_video_prompt(filled: str) -> tuple[str, str]:
    """(headline, closing) from the admin's video prompt. Line 1 = opening, line 2 = closing; empty = defaults."""
    lines = [ln.strip() for ln in (filled or "").splitlines() if ln.strip()]
    return (lines[0][:80] if lines else ""), (lines[1][:80] if len(lines) > 1 else "")


def _headers() -> dict[str, str]:
    return {"x-api-key": get_settings().json2video_api_key, "Content-Type": "application/json"}


def create_movie(body: dict) -> str:
    """Starts a render, returns the JSON2Video project id."""
    res = httpx.post(API, headers=_headers(), json=body, timeout=30)
    data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
    if res.status_code >= 400 or not data.get("success") or not data.get("project"):
        raise Json2VideoError(f"Render not started ({res.status_code}): {data.get('message') or res.text[:300]}")
    return str(data["project"])


def get_movie(project: str) -> dict:
    """Movie status: {status: pending|running|done|error, url, message, ...}."""
    res = httpx.get(API, headers=_headers(), params={"project": project, "format": "simple"}, timeout=30)
    data = res.json()
    if res.status_code >= 400 or not data.get("success"):
        raise Json2VideoError(f"Status failed ({res.status_code}): {data.get('message') or res.text[:300]}")
    return data.get("movie") or {}
