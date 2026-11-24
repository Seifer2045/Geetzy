"""Native JSON2Video templates: the JSON the JSON2Video Editor exports (or a starter from presets.py), with our placeholders.

The admin designs the video in JSON2Video (text styles and animations, transitions, overlays, intro, outro), copies the JSON,
and replaces what changes per gift with placeholders:

  {{photo_1}} … {{photo_10}}   the user's photos    (only as the `src` of an image)
  {{name}} {{sender}} {{fun_fact}} {{occasion}}      (in `text` of text / voice / html elements)
  {{audio}}                    the song             (only as the `src` of an audio element; added automatically when missing)
  {{background}}               the template's background picture (only as the `src` of an image)

Our backend swaps the placeholders, drops scenes whose photos the user did not add (and stretches the others), adds the song,
the watermark (previews) and the webhook, and sends the result to JSON2Video. Nothing else of the design is touched.

Rules that keep it safe and predictable:
- canvas is 1080 x 1920 (9:16); preview and HD use the same size (JSON2Video bills seconds, not pixels);
- every scene has a number `duration`, because the scenes are stretched to the video length;
- no JSON2Video expressions, variables, conditions or iterate (only the placeholders above);
- we set size, quality, webhook and client data ourselves; a template cannot.
"""
import copy
import html as html_lib
import json
import re
from typing import Any

from ..placeholders import MAX_VALUE, _clean
from .movie_template import MovieTemplateError, RenderContext

CANVAS = (1080, 1920)
MAX_BYTES = 60_000
MAX_SCENES = 12
MIN_SCENE_SEC, MAX_SCENE_SEC = 0.5, 15.0
MAX_TEXT = 200
MAX_VOICE_TEXT = 40
MAX_VOICES = 3
MAX_PHOTO_NUMBER = 10

MARKER = re.compile(r"\{\{\s*([A-Za-z_0-9]+)\s*\}\}")
PHOTO = re.compile(r"^photo_(\d{1,2})$")
TEXT_MARKERS = ("name", "sender", "fun_fact", "occasion")
VOICE_MARKERS = ("name", "sender")

ELEMENT_TYPES = {"image", "text", "video", "audio", "voice", "html", "component"}
TOP_KEYS = {"comment", "resolution", "width", "height", "quality", "cache", "fps", "draft", "scenes", "elements"}
FORBIDDEN = {"iterate", "iterate-from", "iterate-to", "iterate-step", "condition", "variables", "template"}
# Scene transition styles of the JSON2Video reference (xfade). "zoomin" is NOT in that list.
TRANSITIONS = {
    "fade", "fadeblack", "fadewhite", "fadegrays", "dissolve", "distance", "pixelize", "radial", "hblur", "wipeleft", "wiperight",
    "wipeup", "wipedown", "wipetl", "wipetr", "wipebl", "wipebr", "slideleft", "slideright", "slideup", "slidedown", "smoothleft",
    "smoothright", "smoothup", "smoothdown", "circlecrop", "rectcrop", "circleopen", "circleclose", "vertopen", "vertclose",
    "horzopen", "horzclose", "diagtl", "diagtr", "diagbl", "diagbr", "hlslice", "hrslice", "vuslice", "vdslice", "squeezeh", "squeezev",
}
DEFAULT_TRANSITION_SEC = 1.0
WATERMARK_Z = 50


def _is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _markers(text: str) -> list[str]:
    return [m.strip() for m in MARKER.findall(text)]


def is_native(movie: Any) -> bool:
    """Compact (Grok-era) templates give every element a fractional `box`; native JSON2Video JSON never does."""
    if not isinstance(movie, dict):
        return False
    return not any(isinstance(e, dict) and "box" in e for e in _all_elements(movie))


def _all_elements(movie: dict) -> list[dict]:
    out = [e for e in movie.get("elements") or [] if isinstance(e, dict)]
    for sc in movie.get("scenes") or []:
        if isinstance(sc, dict):
            out += [e for e in sc.get("elements") or [] if isinstance(e, dict)]
    return out


def _photo_marker(src: Any) -> int | None:
    """The photo number when `src` is exactly one {{photo_k}} placeholder."""
    if not isinstance(src, str):
        return None
    hit = MARKER.fullmatch(src.strip())
    m = PHOTO.match(hit.group(1)) if hit else None
    return int(m.group(1)) if m else None


def _exact_marker(src: Any, name: str) -> bool:
    return isinstance(src, str) and (hit := MARKER.fullmatch(src.strip())) is not None and hit.group(1) == name


def _scene_photo_numbers(scene: dict) -> set[int]:
    return {k for el in scene.get("elements") or [] if isinstance(el, dict) and el.get("type") == "image" and (k := _photo_marker(el.get("src")))}


def _frame_px(el: dict) -> tuple[int, int]:
    """The pixel frame of a photo element: its own width/height, else the whole canvas."""
    w, h = el.get("width"), el.get("height")
    if _is_num(w) and _is_num(h) and w > 0 and h > 0:
        return round(w), round(h)
    return CANVAS


def variant_key(k: int, frame: tuple[int, int]) -> str:
    return f"{k}:{frame[0]}x{frame[1]}"


def photo_frames(movie: dict, *, n_photos: int) -> dict[int, set[tuple[int, int]]]:
    """{photo number: {(width, height)}} for every frame that shows a user photo cut to its frame (resize 'cover')."""
    out: dict[int, set[tuple[int, int]]] = {}
    for el in _all_elements(movie):
        k = _photo_marker(el.get("src")) if el.get("type") == "image" else None
        if k and k <= n_photos and el.get("resize", "cover") == "cover":
            out.setdefault(k, set()).add(_frame_px(el))
    return out


# ───────────────────────────────────────────────────────────── validation
def _walk_forbidden(node: Any, where: str, errs: list[str]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            if key in FORBIDDEN:
                errs.append(f"{where}: '{key}' is not supported (conditions, variables and repeating scenes). Write the scenes out instead.")
            _walk_forbidden(value, where, errs)
    elif isinstance(node, list):
        for value in node:
            _walk_forbidden(value, where, errs)


def _stray_markers(node: Any, allowed: set[int], where: str, errs: list[str], skip: tuple[str, ...]) -> None:
    """Any {{...}} in a string the rules above do not allow (JSON2Video expressions, typos, a marker in the wrong place)."""
    if isinstance(node, dict):
        for key, value in node.items():
            if key not in skip:
                _stray_markers(value, allowed, where, errs, skip)
    elif isinstance(node, list):
        for value in node:
            _stray_markers(value, allowed, where, errs, skip)
    elif isinstance(node, str) and "{{" in node:
        errs.append(f"{where}: '{node[:40]}' contains a placeholder in a place where it is not allowed.")


def _check_element(el: Any, where: str, *, top: bool, photos_max: int, errs: list[str]) -> None:
    if not isinstance(el, dict):
        errs.append(f"{where}: must be an object.")
        return
    kind = el.get("type")
    if kind not in ELEMENT_TYPES:
        errs.append(f"{where}: type '{kind}' is not supported (use {', '.join(sorted(ELEMENT_TYPES))}).")
        return
    _walk_forbidden(el, where, errs)

    if kind == "image":
        src = el.get("src")
        if not isinstance(src, str) or not src.strip():
            errs.append(f"{where}: image needs a 'src': {{{{photo_1}}}}, {{{{background}}}} or an https link.")
        elif (k := _photo_marker(src)):
            if not 1 <= k <= photos_max:
                errs.append(f"{where}: {{{{photo_{k}}}}} is more than the template's max photos ({photos_max}).")
            skip = ("src",)
        elif _exact_marker(src, "background"):
            pass
        elif "{{" in src:
            errs.append(f"{where}: image src must be exactly one placeholder like {{{{photo_1}}}} or {{{{background}}}}, or an https link.")
        elif not src.startswith("https://"):
            errs.append(f"{where}: image src must be {{{{photo_1}}}}…, {{{{background}}}} or an https:// link.")
        _stray_markers({k: v for k, v in el.items() if k != "src"}, set(), where, errs, ())
    elif kind == "audio":
        src = el.get("src")
        if not (_exact_marker(src, "audio") or (isinstance(src, str) and src.startswith("https://") and "{{" not in src)):
            errs.append(f"{where}: audio src must be {{{{audio}}}} (the song) or an https link.")
        _stray_markers({k: v for k, v in el.items() if k != "src"}, set(), where, errs, ())
    elif kind == "video":
        src = el.get("src")
        if not (isinstance(src, str) and src.startswith("https://") and "{{" not in src):
            errs.append(f"{where}: video src must be an https link (user photos cannot go into a video element).")
        _stray_markers({k: v for k, v in el.items() if k != "src"}, set(), where, errs, ())
    elif kind in ("text", "voice", "html"):
        field = "html" if kind == "html" else "text"
        text = el.get(field)
        allowed = VOICE_MARKERS if kind == "voice" else TEXT_MARKERS
        if not isinstance(text, str) or not text.strip():
            errs.append(f"{where}: {field} is empty.")
        else:
            limit = {"text": MAX_TEXT, "voice": MAX_VOICE_TEXT, "html": 6000}[kind]
            if len(text) > limit:
                errs.append(f"{where}: {field} is longer than {limit} characters.")
            for m in _markers(text):
                if m not in allowed:
                    errs.append(f"{where}: {{{{{m}}}}} cannot be used here (allowed: {', '.join('{{' + k + '}}' for k in allowed)}).")
            if "{{" in MARKER.sub("", text) or "}}" in MARKER.sub("", text):
                errs.append(f"{where}: {field} has '{{{{ … }}}}' that is not one of the placeholders "
                            f"({', '.join('{{' + k + '}}' for k in allowed)}). JSON2Video expressions are not supported.")
            if kind == "html" and re.search(r"<\s*script|javascript:", text, re.I):
                errs.append(f"{where}: html must not contain scripts.")
        if kind == "voice" and not top:
            errs.append(f"{where}: voice must be in the top-level 'elements', not inside a scene.")
        _stray_markers({k: v for k, v in el.items() if k != field}, set(), where, errs, ())
    else:  # component
        _stray_markers(el, set(), where, errs, ())


def validate(movie: Any, *, photos_min: int = 1, photos_max: int = 5) -> list[str]:
    """Plain-English problems with a native template. Empty list = safe to render."""
    errs: list[str] = []
    if not isinstance(movie, dict):
        return ["The template must be a JSON object with a 'scenes' list (copy it from the JSON2Video Editor)."]
    if len(json.dumps(movie, ensure_ascii=False)) > MAX_BYTES:
        return [f"The template is too big (max {MAX_BYTES // 1000} KB)."]
    extra = set(movie) - TOP_KEYS
    if extra:
        errs.append(f"Unknown or not allowed top-level field(s): {', '.join(sorted(extra))}. Size, quality, webhook and export are set by Geetzy.")
    for key in ("width", "height"):
        if key in movie and not _is_num(movie[key]):
            errs.append(f"'{key}' must be a number.")
    if (movie.get("width"), movie.get("height")) != (None, None) and (movie.get("width"), movie.get("height")) != CANVAS:
        errs.append(f"The canvas must be {CANVAS[0]} x {CANVAS[1]} (set it in the Editor). Found {movie.get('width')} x {movie.get('height')}.")
    _walk_forbidden({k: v for k, v in movie.items() if k not in ("scenes", "elements")}, "Top level", errs)

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
        _walk_forbidden({k: v for k, v in sc.items() if k != "elements"}, where, errs)
        if not (_is_num(sc.get("duration")) and MIN_SCENE_SEC <= sc["duration"] <= MAX_SCENE_SEC):
            errs.append(f"{where}: 'duration' must be a number from {MIN_SCENE_SEC} to {MAX_SCENE_SEC} seconds (not -1 or -2).")
        tr = sc.get("transition")
        if tr is not None:
            style = tr.get("style") if isinstance(tr, dict) else None
            if style not in TRANSITIONS:
                errs.append(f"{where}: transition style '{style}' is not one of JSON2Video's styles (fade, dissolve, slideleft, wipeleft…).")
            if isinstance(tr, dict) and "duration" in tr and not (_is_num(tr["duration"]) and 0 < tr["duration"] <= 3):
                errs.append(f"{where}: transition duration must be between 0 and 3 seconds.")
        els = sc.get("elements")
        if not isinstance(els, list) or not els:
            errs.append(f"{where}: 'elements' must be a list with at least one element.")
            continue
        for j, el in enumerate(els[:30], 1):
            _check_element(el, f"{where}, element {j}", top=False, photos_max=photos_max, errs=errs)

    top = movie.get("elements", [])
    if not isinstance(top, list) or len(top) > 20:
        errs.append("Top-level 'elements' must be a list of at most 20.")
    else:
        for j, el in enumerate(top, 1):
            _check_element(el, f"Top-level element {j}", top=True, photos_max=photos_max, errs=errs)
        if sum(1 for e in top if isinstance(e, dict) and e.get("type") == "voice") > MAX_VOICES:
            errs.append(f"At most {MAX_VOICES} voice elements are allowed.")
        if sum(1 for e in top if isinstance(e, dict) and e.get("type") == "audio" and _exact_marker(e.get("src"), "audio")) > 1:
            errs.append("Only one {{audio}} element is allowed.")

    if errs:
        return errs
    used = {k for el in _all_elements(movie) if el.get("type") == "image" and (k := _photo_marker(el.get("src")))}
    if not used:
        errs.append("The template shows no user photo. Add an image whose src is {{photo_1}}.")
    elif 1 not in used:
        errs.append("The first photo {{photo_1}} is never used.")
    # must still work when the user adds only the minimum number of photos
    try:
        render(movie, RenderContext(kind="preview", photo_urls=[f"https://x/{k}.jpg" for k in range(max(1, photos_min))],
                                    audio_url="https://x/song.mp3", values={k: "x" for k in TEXT_MARKERS}))
    except MovieTemplateError as e:
        errs.append(f"With only {photos_min} photo(s) the template breaks: {e}")
    return errs


# ───────────────────────────────────────────────────────────── rendering
def _fill(text: str, values: dict[str, str], *, escape: bool = False) -> str:
    def sub(m: re.Match) -> str:
        key = m.group(1).strip()
        if key not in TEXT_MARKERS:
            return ""
        value = _clean(values.get(key, ""), MAX_VALUE.get(key, 40))
        return html_lib.escape(value, quote=True) if escape else value

    return " ".join(MARKER.sub(sub, text).split())


def _scale_times(el: dict, factor: float) -> None:
    """Element start/duration inside a scene follow the scene's stretch (-1 / -2 mean 'automatic' and stay)."""
    for key in ("start", "duration"):
        if _is_num(el.get(key)) and el[key] > 0:
            el[key] = round(el[key] * factor, 3)


def _image(el: dict, ctx: RenderContext) -> dict | None:
    out = dict(el)
    src = el["src"]
    k = _photo_marker(src)
    if k:
        url = ctx.photo_urls[k - 1] if k <= len(ctx.photo_urls) else None
        if not url:
            return None
        if el.get("resize", "cover") == "cover":
            url = ctx.photo_variants.get(variant_key(k, _frame_px(el))) or url
        out["src"] = url
        if not any(key in el for key in ("x", "y", "width", "height", "position")):
            out.update({"position": "custom", "x": 0, "y": 0, "width": CANVAS[0], "height": CANVAS[1]})
        if out.get("resize") == "cover" and _is_num(out.get("width")) and _is_num(out.get("height")):
            out.pop("resize")  # JSON2Video ignores width/height when resize is "cover" (the photo would spill out of its box)
        out.setdefault("duration", -2)
    elif _exact_marker(src, "background"):
        if not ctx.background_url:
            return None
        out["src"] = ctx.background_url
        if not any(key in el for key in ("x", "y", "width", "height", "position")):
            out.update({"position": "custom", "x": 0, "y": 0, "width": CANVAS[0], "height": CANVAS[1]})
        if out.get("resize") == "cover" and _is_num(out.get("width")) and _is_num(out.get("height")):
            out.pop("resize")
        out.setdefault("duration", -2)
    return out


def _audio(ctx: RenderContext, base: dict | None) -> dict:
    out = dict(base or {})
    out.update({"type": "audio", "src": ctx.audio_url, "seek": round(ctx.audio_seek, 2), "duration": ctx.duration_sec})
    out.setdefault("volume", 1)
    out.setdefault("fade-in", 0.3 if ctx.fade and ctx.audio_seek > 0 else 0)
    out.setdefault("fade-out", 1.2 if ctx.fade else 0)
    return out


def _voice(ctx: RenderContext, text: str, start: float, volume: float = 1) -> dict | None:
    spoken = _fill(text, ctx.values)
    if not spoken:
        return None
    return {"type": "voice", "text": spoken, "voice": ctx.voice, "model": ctx.voice_model, "start": round(start, 2), "volume": volume}


def _build(el: dict, ctx: RenderContext, *, factor: float | None) -> dict | None:
    kind = el["type"]
    if kind == "image":
        built = _image(el, ctx)
    elif kind == "text":
        text = _fill(el["text"], ctx.values)
        built = None if not text else {**el, "text": text}
    elif kind == "html":
        built = {**el, "html": MARKER.sub(lambda m: _fill(m.group(0), ctx.values, escape=True), el["html"])}
    elif kind == "voice":
        built = _voice(ctx, el["text"], el.get("start", el.get("at", 0)), el.get("volume", 1)) if ctx.audio_url else None
    elif kind == "audio":
        if _exact_marker(el.get("src"), "audio"):
            built = _audio(ctx, el) if ctx.audio_url else None
        else:
            built = dict(el)
    else:  # video / component pass through (https only, checked on save)
        built = dict(el)
    if built and factor is not None and kind != "audio":
        _scale_times(built, factor)
    return built


def render(movie_json: dict, ctx: RenderContext) -> dict:
    """Native template + one gift's data → JSON2Video movie body (the caller adds `exports` and `client-data`)."""
    movie = copy.deepcopy(movie_json)
    n = len(ctx.photo_urls)
    if n < 1:
        raise MovieTemplateError("no photos")

    scenes = [s for s in movie["scenes"] if all(k <= n for k in _scene_photo_numbers(s))]
    if not scenes:
        raise MovieTemplateError("every scene needs more photos than were added")

    # keep the video length: stretch (or shrink) the remaining scenes; transitions overlap their neighbours
    overlaps = sum((s["transition"].get("duration", DEFAULT_TRANSITION_SEC)) for i, s in enumerate(scenes) if i > 0 and isinstance(s.get("transition"), dict))
    factor = max(0.2, (ctx.duration_sec + overlaps) / sum(s["duration"] for s in scenes))

    out_scenes = []
    for i, sc in enumerate(scenes):
        elements = [b for el in sc["elements"] if (b := _build(el, ctx, factor=factor))]
        scene = {k: v for k, v in sc.items() if k not in ("elements", "transition")}
        scene["duration"] = round(sc["duration"] * factor, 3)
        scene.setdefault("background-color", ctx.color_to)
        scene["elements"] = elements
        if i > 0 and isinstance(sc.get("transition"), dict):
            scene["transition"] = {**sc["transition"], "duration": sc["transition"].get("duration", DEFAULT_TRANSITION_SEC)}
        out_scenes.append(scene)

    top = [b for el in movie.get("elements") or [] if (b := _build(el, ctx, factor=None))]
    # The song was already made (and paid for) for this gift: always play it, even if the template has no audio element.
    if ctx.audio_url and not any(e["type"] == "audio" and e.get("src") == ctx.audio_url for e in top):
        top.append(_audio(ctx, None))
    # The song spec says where the name is spoken. Add those voices unless the template already speaks.
    if ctx.audio_url and not any(e["type"] == "voice" for e in top):
        for slot in ctx.song_slots:
            built = _voice(ctx, slot["text"], slot["at"], slot.get("volume", 1))
            if built:
                top.append(built)
    # The template's background picture is shown when the design has no {{background}} image of its own.
    if ctx.background_url and not any(e["type"] == "image" and e.get("src") == ctx.background_url for e in top + [x for s in out_scenes for x in s["elements"]]):
        top.insert(0, {"type": "image", "src": ctx.background_url, "position": "custom", "x": 0, "y": 0,
                       "width": CANVAS[0], "height": CANVAS[1], "duration": -2, "z-index": 0})
    if ctx.kind == "preview" and ctx.watermark:
        top.append({
            "type": "text", "text": "GEETZY · PREVIEW", "style": "001", "position": "custom", "x": 0, "y": round(CANVAS[1] * 0.08),
            "width": CANVAS[0], "height": round(CANVAS[1] * 0.1), "duration": -2, "z-index": WATERMARK_Z,
            "settings": {"font-family": "Poppins", "font-size": "8vw", "font-weight": "800", "color": "rgba(255,255,255,0.45)",
                         "text-align": "center", "horizontal-position": "center", "vertical-position": "center"},
        })

    body: dict[str, Any] = {k: movie[k] for k in ("comment", "fps") if k in movie}
    body.update({
        "resolution": "custom", "width": CANVAS[0], "height": CANVAS[1],
        "quality": "high" if ctx.kind == "hd" else "medium", "cache": True,
        "scenes": out_scenes, "elements": top,
    })
    # Last line of defence for "every placeholder is replaced": no marker may ever reach JSON2Video.
    if "{{" in json.dumps(body, ensure_ascii=False):
        raise MovieTemplateError("a placeholder was left in the movie")
    return body
