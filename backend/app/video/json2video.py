"""JSON2Video: builds the movie JSON for a gift and talks to the API.

Docs: https://json2video.com/docs/v2 — create `POST /v2/movies`, status `GET /v2/movies?project=`.
Billing is 1 credit per second of output, so a 15 s video costs 15 credits (preview and HD each).
"""
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx

from ..config import get_settings

API = "https://api.json2video.com/v2/movies"
TRANSITION_SEC = 0.6
SIZES = {"preview": (540, 960), "hd": (1080, 1920)}  # vertical 9:16 for WhatsApp Status / Reels
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
    audio_url: str
    audio_seek: float = 0.0
    fade: bool = True
    lyric_lines: list[str] = field(default_factory=list)
    color_from: str = "#FF4D8D"
    color_to: str = "#0A0A0F"
    render_config: dict[str, Any] = field(default_factory=dict)
    duration_sec: int = 15


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
    width, height = SIZES[m.kind]
    cfg = {**STYLE_DEFAULTS.get(m.style, STYLE_DEFAULTS["bollywood"]), **m.render_config}
    font, transition, text_style = cfg["font"], cfg["transition"], cfg["textStyle"]

    n = len(m.photo_urls)
    # Transitions overlap scenes, so each scene is a bit longer to keep the total at duration_sec.
    scene_sec = round((m.duration_sec + (n - 1) * TRANSITION_SEC) / n, 3)
    caption_box_h = int(height * 0.28)
    caption_y = int(height * 0.62)

    scenes = []
    for i, url in enumerate(m.photo_urls):
        elements: list[dict] = [
            {
                "type": "image",
                "src": url,
                "resize": "cover",
                "position": "center-center",
                "zoom": 2,
                "pan": PANS[i % len(PANS)],
                "duration": -2,
            }
        ]
        if i == 0:
            headline = HEADLINE.get(m.occasion, "For {name}").format(name=m.recipient_name)
            elements.append(_text(headline, font=font, size_vw=9, y=caption_y, w=width, h=caption_box_h, style=text_style))
        elif i == n - 1:
            elements.append(_text(f"With love, {m.sender_name}", font=font, size_vw=7, y=caption_y, w=width, h=caption_box_h, style="002"))
        elif i - 1 < len(m.lyric_lines):
            elements.append(_text(m.lyric_lines[i - 1], font=font, size_vw=6, y=caption_y, w=width, h=caption_box_h, style="002"))

        scene: dict[str, Any] = {"background-color": m.color_to, "duration": scene_sec, "elements": elements}
        if i > 0:
            scene["transition"] = {"style": transition, "duration": TRANSITION_SEC}
        scenes.append(scene)

    movie_elements: list[dict] = [
        {
            "type": "audio",
            "src": m.audio_url,
            "seek": round(m.audio_seek, 2),  # skip into the song (own song trim)
            "duration": m.duration_sec,
            "fade-in": 0.3 if m.fade and m.audio_seek > 0 else 0,
            "fade-out": 1.2 if m.fade else 0,
        }
    ]
    if m.kind == "preview":
        movie_elements.append(
            _text("GEETZY · PREVIEW", font="Poppins", size_vw=8, y=int(height * 0.08), w=width, h=int(height * 0.1),
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
