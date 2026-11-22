"""Movie template: the JSON that Grok (or the admin) writes, and the renderer that turns it into a JSON2Video movie.

Why our own format? Grok's output is UNTRUSTED. This format is JSON2Video-shaped but small and strict:
- only `image`, `text`, `audio` elements (no remote video/html/components → no extra credits, no remote code);
- every picture/sound is a MARKER like {{photo_1}} — a template can never contain a link of its own;
- geometry is in fractions of the canvas (`box: [x, y, w, h]`, text `size`), so one JSON renders at 540×960 and 1080×1920;
- the backend, not the template, sets size, quality, webhook and export target.

Markers
  photos   {{photo_1}} … {{photo_10}}     a scene whose photo number is above the user's photo count is dropped,
                                          then the remaining scenes are stretched so the video keeps `duration_sec`
  text     {{name}} {{sender}} {{fun_fact}} {{occasion}}     (cleaned and capped, see placeholders.py)
  audio    {{audio}}                      the song (seek/fade are set by the renderer; removed for silent videos)
  images   {{art}} frame overlay PNG · {{background}} uploaded background or gradient (removed when not available)
"""
import copy
import json
import re
from dataclasses import dataclass, field
from typing import Any, Literal

from ..placeholders import MAX_VALUE, _clean

MAX_BYTES = 20_000
MAX_SCENES = 12
MAX_ELEMENTS = 10
MAX_TEXT = 120
MIN_SCENE_SEC, MAX_SCENE_SEC = 0.5, 15.0
TRANSITION_SEC = 0.6
MAX_PHOTO_MARKERS = 10
SIZES = {"preview": (540, 960), "hd": (1080, 1920)}

TEXT_MARKERS = ("name", "sender", "fun_fact", "occasion")
MARKER = re.compile(r"\{\{\s*([A-Za-z_0-9]+)\s*\}\}")
PHOTO = re.compile(r"^photo_(\d{1,2})$")

TRANSITIONS = {
    "fade", "fadeblack", "fadewhite", "dissolve", "slideleft", "slideright", "slideup", "slidedown", "wipeleft",
    "wiperight", "circleopen", "circleclose", "pixelize", "radial", "zoomin",
}
FONTS = {
    "Poppins", "Playfair Display", "VT323", "Inter", "Montserrat", "Lobster", "Pacifico", "Roboto", "Oswald", "Dancing Script",
}
PANS = {"left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"}
FITS = {"cover", "contain", "fill"}
TEXT_STYLES = {"001", "002", "003", "004", "005"}
ALIGNS = {"left", "center", "right"}

TOP_KEYS = {"scenes", "elements"}
SCENE_KEYS = {"duration", "background", "transition", "elements"}
ELEMENT_KEYS = {
    "image": {"type", "src", "box", "fit", "zoom", "pan", "z"},
    "text": {"type", "text", "box", "size", "color", "font", "weight", "align", "shadow", "style", "z"},
    "audio": {"type", "src", "volume"},
}
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


class MovieTemplateError(ValueError):
    pass


@dataclass(frozen=True)
class RenderContext:
    kind: Literal["preview", "hd"]
    photo_urls: list[str]
    duration_sec: int = 15
    audio_url: str | None = None
    audio_seek: float = 0.0
    fade: bool = True
    art_url: str | None = None
    background_url: str | None = None
    color_to: str = "#0A0A0F"
    values: dict[str, str] = field(default_factory=dict)  # name, sender, fun_fact, occasion
    watermark: bool = True


# ───────────────────────────────────────────────────────────── validation
def _is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _markers(text: str) -> list[str]:
    return [m.strip() for m in MARKER.findall(text)]


def photo_numbers(movie: dict) -> set[int]:
    """Every photo number the template uses (from image `src` markers)."""
    nums: set[int] = set()
    for el in _all_elements(movie):
        if el.get("type") == "image" and isinstance(el.get("src"), str):
            for m in _markers(el["src"]):
                hit = PHOTO.match(m)
                if hit:
                    nums.add(int(hit.group(1)))
    return nums


def _all_elements(movie: dict) -> list[dict]:
    out = [e for e in movie.get("elements") or [] if isinstance(e, dict)]
    for sc in movie.get("scenes") or []:
        if isinstance(sc, dict):
            out += [e for e in sc.get("elements") or [] if isinstance(e, dict)]
    return out


def _check_box(el: dict, where: str, errs: list[str]) -> None:
    box = el.get("box")
    if box is None:
        return
    if not (isinstance(box, list) and len(box) == 4 and all(_is_num(v) for v in box)):
        errs.append(f"{where}: box must be 4 numbers [x, y, width, height].")
        return
    x, y, w, h = box
    if min(x, y) < -0.01 or w <= 0 or h <= 0 or x + w > 1.01 or y + h > 1.01:
        errs.append(f"{where}: box must stay inside the picture (numbers between 0 and 1).")


def _check_element(el: Any, where: str, *, top: bool, photos_max: int, errs: list[str]) -> None:
    if not isinstance(el, dict):
        errs.append(f"{where}: must be an object.")
        return
    kind = el.get("type")
    if kind not in ELEMENT_KEYS:
        errs.append(f"{where}: type '{kind}' is not allowed (use image, text or audio).")
        return
    extra = set(el) - ELEMENT_KEYS[kind]
    if extra:
        errs.append(f"{where}: unknown field(s) {', '.join(sorted(extra))}.")
    _check_box(el, where, errs)
    if "z" in el and not (isinstance(el["z"], int) and not isinstance(el["z"], bool) and 0 <= el["z"] <= 30):
        errs.append(f"{where}: z must be a whole number from 0 to 30.")

    if kind == "audio":
        if not top:
            errs.append(f"{where}: audio must be in the top-level 'elements', not inside a scene.")
        if el.get("src") != "{{audio}}":
            errs.append(f"{where}: audio src must be exactly {{{{audio}}}}.")
        if "volume" in el and not (_is_num(el["volume"]) and 0 <= el["volume"] <= 1):
            errs.append(f"{where}: volume must be between 0 and 1.")
    elif kind == "image":
        src = el.get("src")
        hit = MARKER.fullmatch(src.strip()) if isinstance(src, str) else None
        marker = hit.group(1) if hit else None
        number = PHOTO.match(marker) if marker else None
        if not marker:
            errs.append(f"{where}: image src must be one marker like {{{{photo_1}}}}, {{{{art}}}} or {{{{background}}}} (no links).")
        elif number:
            if not 1 <= int(number.group(1)) <= photos_max:
                errs.append(f"{where}: {{{{{marker}}}}} is more than the template's max photos ({photos_max}).")
        elif marker not in ("art", "background"):
            errs.append(f"{where}: unknown marker {{{{{marker}}}}} for an image.")
        if "fit" in el and el["fit"] not in FITS:
            errs.append(f"{where}: fit must be one of {', '.join(sorted(FITS))}.")
        if "pan" in el and el["pan"] not in PANS:
            errs.append(f"{where}: pan must be one of {', '.join(sorted(PANS))}.")
        if "zoom" in el and not (_is_num(el["zoom"]) and -10 <= el["zoom"] <= 10):
            errs.append(f"{where}: zoom must be between -10 and 10.")
    else:  # text
        text = el.get("text")
        if not isinstance(text, str) or not text.strip():
            errs.append(f"{where}: text is empty.")
        else:
            if len(text) > MAX_TEXT:
                errs.append(f"{where}: text is longer than {MAX_TEXT} characters.")
            for m in _markers(text):
                if m not in TEXT_MARKERS:
                    errs.append(f"{where}: {{{{{m}}}}} cannot be used in text (allowed: {', '.join('{{' + k + '}}' for k in TEXT_MARKERS)}).")
        if "size" in el and not (_is_num(el["size"]) and 0.02 <= el["size"] <= 0.2):
            errs.append(f"{where}: size must be between 0.02 and 0.2 (fraction of the picture width).")
        if "color" in el and not (isinstance(el["color"], str) and HEX.match(el["color"])):
            errs.append(f"{where}: color must look like #FFFFFF.")
        if "font" in el and el["font"] not in FONTS:
            errs.append(f"{where}: font must be one of {', '.join(sorted(FONTS))}.")
        if "weight" in el and el["weight"] not in (400, 500, 600, 700, 800, 900):
            errs.append(f"{where}: weight must be 400, 500, 600, 700, 800 or 900.")
        if "align" in el and el["align"] not in ALIGNS:
            errs.append(f"{where}: align must be left, center or right.")
        if "shadow" in el and not isinstance(el["shadow"], bool):
            errs.append(f"{where}: shadow must be true or false.")
        if "style" in el and el["style"] not in TEXT_STYLES:
            errs.append(f"{where}: style must be one of {', '.join(sorted(TEXT_STYLES))}.")


def validate(movie: Any, *, photos_min: int = 1, photos_max: int = 5) -> list[str]:
    """Plain-English problems with a movie template. Empty list = safe to render."""
    errs: list[str] = []
    if not isinstance(movie, dict):
        return ["The template must be a JSON object with a 'scenes' list."]
    if len(json.dumps(movie, ensure_ascii=False)) > MAX_BYTES:
        return [f"The template is too big (max {MAX_BYTES // 1000} KB)."]
    extra = set(movie) - TOP_KEYS
    if extra:
        errs.append(f"Unknown top-level field(s): {', '.join(sorted(extra))}. Only 'scenes' and 'elements' are allowed.")
    scenes = movie.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        return errs + ["'scenes' must be a list with at least one scene."]
    if len(scenes) > MAX_SCENES:
        errs.append(f"Too many scenes ({len(scenes)}); the maximum is {MAX_SCENES}.")

    for i, sc in enumerate(scenes[: MAX_SCENES + 1], 1):
        where = f"Scene {i}"
        if not isinstance(sc, dict):
            errs.append(f"{where}: must be an object.")
            continue
        extra = set(sc) - SCENE_KEYS
        if extra:
            errs.append(f"{where}: unknown field(s) {', '.join(sorted(extra))}.")
        if not (_is_num(sc.get("duration")) and MIN_SCENE_SEC <= sc["duration"] <= MAX_SCENE_SEC):
            errs.append(f"{where}: duration must be a number from {MIN_SCENE_SEC} to {MAX_SCENE_SEC} seconds.")
        if "background" in sc and not (isinstance(sc["background"], str) and HEX.match(sc["background"])):
            errs.append(f"{where}: background must look like #0A0A0F.")
        if "transition" in sc and sc["transition"] not in TRANSITIONS:
            errs.append(f"{where}: transition '{sc['transition']}' is not allowed.")
        els = sc.get("elements")
        if not isinstance(els, list) or not els:
            errs.append(f"{where}: 'elements' must be a list with at least one element.")
            continue
        if len(els) > MAX_ELEMENTS:
            errs.append(f"{where}: too many elements (max {MAX_ELEMENTS}).")
        for j, el in enumerate(els[: MAX_ELEMENTS + 1], 1):
            _check_element(el, f"{where}, element {j}", top=False, photos_max=photos_max, errs=errs)

    top = movie.get("elements", [])
    if not isinstance(top, list) or len(top) > MAX_ELEMENTS:
        errs.append(f"Top-level 'elements' must be a list of at most {MAX_ELEMENTS}.")
    else:
        for j, el in enumerate(top, 1):
            _check_element(el, f"Top-level element {j}", top=True, photos_max=photos_max, errs=errs)
        if sum(1 for e in top if isinstance(e, dict) and e.get("type") == "audio") > 1:
            errs.append("Only one audio element is allowed.")

    if errs:
        return errs
    if not photo_numbers(movie):
        errs.append("The template uses no photo. Add an image with src {{photo_1}}.")
    elif 1 not in photo_numbers(movie):
        errs.append("The first photo {{photo_1}} is never used.")
    # must still work when the user adds only the minimum number of photos
    try:
        render_template(movie, RenderContext(kind="preview", photo_urls=[f"https://x/{k}" for k in range(photos_min)],
                                             values={k: "x" for k in TEXT_MARKERS}))
    except MovieTemplateError as e:
        errs.append(f"With only {photos_min} photo(s) the template breaks: {e}")
    return errs


# ───────────────────────────────────────────────────────────── rendering
def _scene_photo_numbers(scene: dict) -> set[int]:
    nums: set[int] = set()
    for el in scene.get("elements") or []:
        if el.get("type") == "image":
            for m in _markers(el.get("src", "")):
                hit = PHOTO.match(m)
                if hit:
                    nums.add(int(hit.group(1)))
    return nums


def _fill_text(text: str, values: dict[str, str]) -> str:
    def sub(m: re.Match) -> str:
        key = m.group(1).strip()
        return _clean(values.get(key, ""), MAX_VALUE.get(key, 40)) if key in TEXT_MARKERS else ""
    return " ".join(MARKER.sub(sub, text).split())


def _px(box: list[float], size: tuple[int, int]) -> dict[str, int]:
    w, h = size
    x, y, bw, bh = box
    return {"x": round(x * w), "y": round(y * h), "width": max(1, round(bw * w)), "height": max(1, round(bh * h))}


def _image(el: dict, ctx: RenderContext, size: tuple[int, int], i: int) -> dict | None:
    marker = _markers(el["src"])[0]
    hit = PHOTO.match(marker)
    if hit:
        k = int(hit.group(1))
        url = ctx.photo_urls[k - 1] if k <= len(ctx.photo_urls) else None
    elif marker == "art":
        url = ctx.art_url
    else:
        url = ctx.background_url
    if not url:
        return None
    out: dict[str, Any] = {"type": "image", "src": url, "resize": el.get("fit", "cover"), "duration": -2}
    out.update({"position": "custom", **_px(el.get("box") or [0, 0, 1, 1], size)})
    if "zoom" in el:
        out["zoom"] = el["zoom"]
    elif hit:
        out["zoom"] = 2
    if "pan" in el or hit:
        out["pan"] = el.get("pan", ["right", "left", "top", "bottom"][i % 4])
    out["z-index"] = el.get("z", 1 if hit else 10 if marker == "art" else 0)
    return out


def _text(el: dict, ctx: RenderContext, size: tuple[int, int]) -> dict | None:
    text = _fill_text(el["text"], ctx.values)
    if not text:
        return None
    w, _h = size
    out: dict[str, Any] = {
        "type": "text", "text": text, "style": el.get("style", "002"), "position": "custom",
        **_px(el.get("box") or [0, 0.66, 1, 0.2], size),
        "settings": {
            "font-family": el.get("font", "Poppins"),
            "font-size": f"{round(el.get('size', 0.07) * 100, 2)}vw",
            "font-weight": str(el.get("weight", 800)),
            "color": el.get("color", "#FFFFFF"),
            "text-align": el.get("align", "center"),
            "horizontal-position": el.get("align", "center"),
            "vertical-position": "center",
            "text-shadow": "0 4px 18px rgba(0,0,0,0.65)" if el.get("shadow", True) else "none",
        },
        "z-index": el.get("z", 20),
    }
    return out


def render_template(movie_json: dict, ctx: RenderContext) -> dict:
    """Movie template + one gift's data → JSON2Video movie body (without webhook; the caller adds `exports`)."""
    movie = copy.deepcopy(movie_json)
    size = SIZES[ctx.kind]
    n = len(ctx.photo_urls)
    if n < 1:
        raise MovieTemplateError("no photos")

    scenes = [s for s in movie["scenes"] if all(k <= n for k in _scene_photo_numbers(s))]
    if not scenes:
        raise MovieTemplateError("every scene needs more photos than were added")

    # stretch the remaining scenes so the video keeps its length (transitions overlap neighbours)
    overlaps = TRANSITION_SEC * sum(1 for i, s in enumerate(scenes) if i > 0 and s.get("transition"))
    factor = (ctx.duration_sec + overlaps) / sum(s["duration"] for s in scenes)

    out_scenes = []
    for i, sc in enumerate(scenes):
        elements = []
        for el in sc["elements"]:
            built = _image(el, ctx, size, i) if el["type"] == "image" else _text(el, ctx, size)
            if built:
                elements.append(built)
        scene: dict[str, Any] = {
            "background-color": sc.get("background", ctx.color_to),
            "duration": round(sc["duration"] * factor, 3),
            "elements": elements,
        }
        if i > 0 and sc.get("transition"):
            scene["transition"] = {"style": sc["transition"], "duration": TRANSITION_SEC}
        out_scenes.append(scene)

    top: list[dict] = []
    for el in movie.get("elements") or []:
        if el["type"] == "audio":
            if ctx.audio_url:
                top.append({
                    "type": "audio", "src": ctx.audio_url, "seek": round(ctx.audio_seek, 2), "duration": ctx.duration_sec,
                    "volume": el.get("volume", 1),
                    "fade-in": 0.3 if ctx.fade and ctx.audio_seek > 0 else 0, "fade-out": 1.2 if ctx.fade else 0,
                })
        elif el["type"] == "image":
            built = _image(el, ctx, size, 0)
            if built:
                top.append(built)
        else:
            built = _text(el, ctx, size)
            if built:
                built["duration"] = -2
                top.append(built)
    if ctx.kind == "preview" and ctx.watermark:
        top.append({
            "type": "text", "text": "GEETZY · PREVIEW", "style": "001", "position": "custom", "x": 0, "y": round(size[1] * 0.08),
            "width": size[0], "height": round(size[1] * 0.1), "duration": -2, "z-index": 50,
            "settings": {"font-family": "Poppins", "font-size": "8vw", "font-weight": "800", "color": "rgba(255,255,255,0.45)",
                         "text-align": "center", "horizontal-position": "center", "vertical-position": "center"},
        })

    return {
        "resolution": "custom", "width": size[0], "height": size[1],
        "quality": "high" if ctx.kind == "hd" else "medium", "cache": True,
        "scenes": out_scenes, "elements": top,
    }
