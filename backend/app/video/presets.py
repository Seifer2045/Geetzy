"""Starter templates in native JSON2Video JSON (1080 x 1920), so the admin can begin without the JSON2Video Editor.

Each one is a full design: an animated intro, photo scenes with different layouts and transitions, captions, a closing card,
and the placeholders the backend swaps for every gift (see native_template.py):
  {{photo_1}}…  {{name}} {{sender}} {{fun_fact}} {{occasion}}  {{audio}}  {{background}}

Scenes that use a photo the user did not add are dropped automatically, so a template written for 4 photos also works with 3.
Decorations are JSON2Video `html` elements (CSS gradients, borders, glow): they are transparent layers above the photo and below the text.
"""
from typing import Any

W, H = 1080, 1920


def _text(text: str, y: int, h: int, size_vw: float, color: str, *, font: str = "Poppins", weight: str = "800", style: str = "002",
          x: int = 40, w: int = 1000, fade_in: float = 0.5, start: float | None = None, shadow: str = "0 4px 22px rgba(0,0,0,0.6)",
          z: int = 20, spacing: str | None = None) -> dict[str, Any]:
    settings = {
        "font-family": font, "font-size": f"{size_vw}vw", "font-weight": weight, "color": color, "text-align": "center",
        "horizontal-position": "center", "vertical-position": "center", "text-shadow": shadow,
    }
    if spacing:
        settings["letter-spacing"] = spacing
    el: dict[str, Any] = {"type": "text", "text": text, "style": style, "position": "custom", "x": x, "y": y, "width": w, "height": h,
                          "settings": settings, "z-index": z, "fade-in": fade_in}
    if start is not None:
        el["start"] = start
    return el


def _photo(k: int, x: int, y: int, w: int, h: int, *, zoom: int = 2, fade_in: float = 0.4) -> dict[str, Any]:
    # No "resize": JSON2Video ignores width/height when resize is "cover". Our own cut already has this frame's exact aspect.
    return {"type": "image", "src": f"{{{{photo_{k}}}}}", "position": "custom", "x": x, "y": y, "width": w, "height": h,
            "zoom": zoom, "z-index": 1, "fade-in": fade_in}


def _html(markup: str, x: int = 0, y: int = 0, w: int = W, h: int = H, z: int = 5) -> dict[str, Any]:
    """An html layer. JSON2Video draws it with a collapsed height unless the div has pixel sizes, so 100% is replaced by the real size."""
    markup = markup.replace("width:100%;height:100%", f"width:{w}px;height:{h}px")
    return {"type": "html", "html": markup, "position": "custom", "x": x, "y": y, "width": w, "height": h, "z-index": z}


def _frame(x: int, y: int, w: int, h: int, color: str, glow: str, *, radius: int = 28, border: int = 12) -> dict[str, Any]:
    """A coloured border (with a soft glow) around a photo box, drawn above the photo."""
    pad = 14
    return _html(
        f'<div style="width:100%;height:100%;box-sizing:border-box;border:{border}px solid {color};border-radius:{radius}px;'
        f'box-shadow:0 0 34px {glow}, inset 0 0 26px {glow}"></div>',
        x - pad, y - pad, w + 2 * pad, h + 2 * pad, z=5,
    )


def _round(x: int, y: int, w: int, h: int, bg: str, ring: str, glow: str, *, border: int = 10) -> dict[str, Any]:
    """Turns a photo box into a circle/oval: everything outside it is covered with the scene colour, with a glowing ring on the edge."""
    markup = (
        f'<div style="position:relative;width:{W}px;height:{H}px;overflow:hidden">'
        f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;box-sizing:border-box;border-radius:50%;'
        f'border:{border}px solid {ring};box-shadow:0 0 0 2400px {bg}, 0 0 34px {glow}"></div></div>'
    )
    return _html(markup, 0, 0, W, H, z=5)


def _glow(top: str, bottom: str, at: str = "50% 38%") -> dict[str, Any]:
    """A full-screen soft light on a dark scene (a gradient, so no picture is needed)."""
    return _html(f'<div style="width:100%;height:100%;background:radial-gradient(circle at {at}, {top} 0%, {bottom} 62%)"></div>', z=0)


def _scene(duration: float, elements: list[dict], *, bg: str, transition: str | None = None, tr_sec: float = 0.8) -> dict[str, Any]:
    scene: dict[str, Any] = {"duration": duration, "background-color": bg, "elements": elements}
    if transition:
        scene["transition"] = {"style": transition, "duration": tr_sec}
    return scene


def _movie(scenes: list[dict], *, with_background: bool = True) -> dict[str, Any]:
    elements: list[dict[str, Any]] = [{"type": "audio", "src": "{{audio}}"}]
    if with_background:
        elements.insert(0, {"type": "image", "src": "{{background}}", "position": "custom", "x": 0, "y": 0, "width": W, "height": H, "z-index": 0})
    return {"comment": "Geetzy starter template", "resolution": "custom", "width": W, "height": H, "scenes": scenes, "elements": elements}


# ───────────────────────────────────────────────────────────── 1. Royal Birthday (gold / maroon, Bollywood)
def _royal_birthday() -> dict[str, Any]:
    bg, gold, glow = "#3A0A12", "#F6D27A", "rgba(246,210,122,0.55)"
    return _movie([
        _scene(3.4, [
            _glow("rgba(246,196,90,0.38)", "#3A0A12"),
            _text("HAPPY", 560, 150, 9, gold, font="Playfair Display", weight="700", style="003", fade_in=0.4, spacing="0.3em"),
            _text("BIRTHDAY", 700, 190, 13, "#FFF2CC", font="Playfair Display", weight="800", style="003", fade_in=0.8),
            _text("{{name}}", 930, 170, 9, gold, font="Dancing Script", weight="700", fade_in=1.3),
        ], bg=bg),
        _scene(2.9, [
            _photo(1, 110, 230, 860, 1020), _frame(110, 230, 860, 1020, gold, glow),
            _text("{{fun_fact}}", 1370, 230, 5.2, "#FFFFFF", font="Playfair Display", weight="600", fade_in=0.7),
        ], bg=bg, transition="fadewhite"),
        _scene(2.9, [
            _photo(2, 0, 0, W, 1500, zoom=3, fade_in=0.2),
            _html('<div style="width:100%;height:100%;background:linear-gradient(to top, rgba(58,10,18,0.95), rgba(58,10,18,0))"></div>', 0, 1100, W, 820, z=4),
            _text("Many happy returns,", 1500, 110, 6, gold, font="Playfair Display", weight="600", fade_in=0.6),
            _text("{{name}}!", 1610, 150, 9.5, "#FFF2CC", font="Dancing Script", weight="700", fade_in=0.9),
        ], bg=bg, transition="slideleft"),
        _scene(2.9, [
            _photo(3, 190, 320, 700, 900, zoom=2), _round(190, 320, 700, 900, bg, gold, glow),
            _text("{{occasion}}", 1340, 140, 6, gold, font="Playfair Display", weight="600", fade_in=0.6),
            _text("{{fun_fact}}", 1470, 220, 4.6, "#FFFFFF", font="Poppins", weight="500", fade_in=1.0),
        ], bg=bg, transition="dissolve"),
        _scene(2.9, [
            _photo(4, 110, 260, 860, 980, zoom=2), _frame(110, 260, 860, 980, gold, glow),
            _text("Celebrate big!", 1340, 150, 8, "#FFF2CC", font="Dancing Script", weight="700", fade_in=0.6),
        ], bg=bg, transition="circleopen"),
        _scene(2.4, [
            _glow("rgba(246,196,90,0.30)", "#3A0A12", "50% 50%"),
            _text("With love,", 740, 130, 6, gold, font="Playfair Display", weight="600", fade_in=0.4),
            _text("{{sender}}", 880, 190, 11, "#FFF2CC", font="Dancing Script", weight="700", fade_in=0.9),
        ], bg=bg, transition="fadeblack"),
    ])


# ───────────────────────────────────────────────────────────── 2. Romantic Anniversary (rose gold)
def _romantic_anniversary() -> dict[str, Any]:
    bg, rose, cream, glow = "#2B0B1D", "#F4C6B8", "#FFF3E8", "rgba(244,198,184,0.5)"
    return _movie([
        _scene(3.4, [
            _glow("rgba(244,150,170,0.32)", "#2B0B1D", "50% 45%"),
            _text("Happy", 600, 140, 8, rose, font="Dancing Script", weight="700", fade_in=0.5),
            _text("ANNIVERSARY", 730, 170, 10.5, cream, font="Playfair Display", weight="700", style="003", fade_in=0.9, spacing="0.12em"),
            _text("{{name}}", 930, 160, 8.5, rose, font="Dancing Script", weight="700", fade_in=1.5),
        ], bg=bg),
        _scene(3.0, [
            _photo(1, 150, 300, 780, 940, zoom=2),
            _html('<div style="width:100%;height:100%;box-sizing:border-box;border:18px solid #FFF3E8;box-shadow:0 14px 44px rgba(0,0,0,0.55)"></div>', 136, 286, 808, 968, z=5),
            _text("{{fun_fact}}", 1340, 220, 5, cream, font="Dancing Script", weight="600", fade_in=0.8),
        ], bg=bg, transition="dissolve", tr_sec=1.0),
        _scene(3.0, [
            _photo(2, 0, 0, W, 1920, zoom=3, fade_in=0.4),
            _html('<div style="width:100%;height:100%;background:linear-gradient(to top, rgba(43,11,29,0.92), rgba(43,11,29,0) 55%)"></div>', z=4),
            _text("Every moment with you", 1450, 150, 6, cream, font="Dancing Script", weight="700", fade_in=0.8),
            _text("is my favourite", 1580, 150, 6, rose, font="Dancing Script", weight="700", fade_in=1.3),
        ], bg=bg, transition="dissolve", tr_sec=1.0),
        _scene(3.0, [
            _photo(3, 150, 360, 780, 840, zoom=2), _frame(150, 360, 780, 840, rose, glow, radius=40, border=8),
            _text("{{occasion}}", 1290, 130, 6, rose, font="Playfair Display", weight="600", fade_in=0.6),
            _text("{{name}}", 1410, 150, 7.5, cream, font="Dancing Script", weight="700", fade_in=1.0),
        ], bg=bg, transition="fade", tr_sec=1.0),
        _scene(2.8, [
            _photo(4, 140, 280, 800, 980, zoom=2), _round(140, 280, 800, 980, bg, rose, glow, border=8),
            _text("Forever together", 1360, 150, 7.5, cream, font="Dancing Script", weight="700", fade_in=0.7),
        ], bg=bg, transition="dissolve", tr_sec=1.0),
        _scene(2.4, [
            _glow("rgba(244,150,170,0.28)", "#2B0B1D", "50% 50%"),
            _text("Thank you,", 720, 130, 7, rose, font="Dancing Script", weight="700", fade_in=0.4),
            _text("{{name}}", 850, 180, 11, cream, font="Dancing Script", weight="700", fade_in=0.9),
            _text("With love, {{sender}}", 1060, 120, 5, rose, font="Playfair Display", weight="500", fade_in=1.4),
        ], bg=bg, transition="fadeblack", tr_sec=1.0),
    ])


# ───────────────────────────────────────────────────────────── 3. Neon Party (Gen Z)
def _neon_party() -> dict[str, Any]:
    bg, pink, cyan = "#0A0A1F", "#FF2E93", "#2EF2FF"
    glow_p, glow_c = "rgba(255,46,147,0.75)", "rgba(46,242,255,0.75)"
    return _movie([
        _scene(2.8, [
            _glow("rgba(255,46,147,0.45)", "#0A0A1F", "30% 30%"),
            _text("IT'S", 560, 150, 9, cyan, font="Oswald", weight="700", fade_in=0.2, shadow=f"0 0 24px {glow_c}"),
            _text("PARTY", 690, 260, 20, "#FFFFFF", font="Oswald", weight="800", fade_in=0.4, shadow=f"0 0 32px {glow_p}"),
            _text("TIME", 940, 260, 20, pink, font="Oswald", weight="800", fade_in=0.7, shadow=f"0 0 32px {glow_p}"),
            _text("{{name}}", 1250, 160, 9, "#FFFFFF", font="Montserrat", weight="800", fade_in=1.1, shadow=f"0 0 24px {glow_c}"),
        ], bg=bg),
        _scene(2.6, [
            _photo(1, 0, 0, W, 1920, zoom=3, fade_in=0.1),
            _html('<div style="width:100%;height:100%;background:linear-gradient(to top, rgba(10,10,31,0.9), rgba(10,10,31,0) 45%)"></div>', z=4),
            _frame(30, 30, 1020, 1860, pink, glow_p, radius=12, border=8),
            _text("{{occasion}}", 1560, 140, 8, "#FFFFFF", font="Oswald", weight="800", fade_in=0.3, shadow=f"0 0 24px {glow_p}"),
        ], bg=bg, transition="slideleft", tr_sec=0.5),
        _scene(2.6, [
            _photo(2, 90, 280, 900, 1000, zoom=2, fade_in=0.1), _frame(90, 280, 900, 1000, cyan, glow_c, radius=18, border=10),
            _text("{{fun_fact}}", 1380, 260, 5.4, "#FFFFFF", font="Montserrat", weight="700", fade_in=0.3, shadow=f"0 0 20px {glow_c}"),
        ], bg=bg, transition="slideup", tr_sec=0.5),
        _scene(2.6, [
            _photo(3, 0, 0, W, 1920, zoom=3, fade_in=0.1),
            _html('<div style="width:100%;height:100%;background:linear-gradient(to top, rgba(10,10,31,0.9), rgba(10,10,31,0) 45%)"></div>', z=4),
            _frame(30, 30, 1020, 1860, cyan, glow_c, radius=12, border=8),
            _text("LEVEL UP!", 1560, 160, 10, pink, font="Oswald", weight="800", fade_in=0.3, shadow=f"0 0 28px {glow_p}"),
        ], bg=bg, transition="wipeleft", tr_sec=0.5),
        _scene(2.6, [
            _photo(4, 120, 300, 840, 960, zoom=2, fade_in=0.1), _frame(120, 300, 840, 960, pink, glow_p, radius=18, border=10),
            _text("{{name}}", 1360, 160, 9, "#FFFFFF", font="Oswald", weight="800", fade_in=0.3, shadow=f"0 0 24px {glow_p}"),
        ], bg=bg, transition="slideright", tr_sec=0.5),
        _scene(2.4, [
            _glow("rgba(46,242,255,0.35)", "#0A0A1F", "70% 70%"),
            _text("BIG LOVE FROM", 740, 130, 6, cyan, font="Montserrat", weight="700", fade_in=0.3, shadow=f"0 0 20px {glow_c}"),
            _text("{{sender}}", 880, 220, 13, "#FFFFFF", font="Oswald", weight="800", fade_in=0.6, shadow=f"0 0 30px {glow_p}"),
        ], bg=bg, transition="fadeblack", tr_sec=0.5),
    ])


# ───────────────────────────────────────────────────────────── 4. Soft Apology
def _soft_apology() -> dict[str, Any]:
    bg, ink, accent = "#F7E9EE", "#4A2A3A", "#B5546F"
    return _movie([
        _scene(3.2, [
            _text("I'm sorry,", 640, 170, 11, ink, font="Dancing Script", weight="700", fade_in=0.6),
            _text("{{name}}", 840, 200, 12, accent, font="Dancing Script", weight="700", fade_in=1.3),
            _text("from the bottom of my heart", 1100, 120, 4.6, ink, font="Playfair Display", weight="500", fade_in=2.0, shadow="none"),
        ], bg=bg),
        _scene(3.2, [
            _photo(1, 150, 280, 780, 960, zoom=2),
            _html('<div style="width:100%;height:100%;box-sizing:border-box;border:16px solid #FFFFFF;box-shadow:0 12px 36px rgba(74,42,58,0.35)"></div>', 136, 266, 808, 988, z=5),
            _text("{{fun_fact}}", 1350, 220, 5, ink, font="Playfair Display", weight="600", fade_in=0.8, shadow="none"),
        ], bg=bg, transition="dissolve", tr_sec=1.0),
        _scene(3.2, [
            _photo(2, 110, 320, 860, 860, zoom=2), _round(110, 320, 860, 860, bg, accent, "rgba(181,84,111,0.35)", border=8),
            _text("I miss our good times", 1290, 150, 6, accent, font="Dancing Script", weight="700", fade_in=0.8, shadow="none"),
        ], bg=bg, transition="fade", tr_sec=1.0),
        _scene(3.2, [
            _photo(3, 150, 300, 780, 940, zoom=2),
            _html('<div style="width:100%;height:100%;box-sizing:border-box;border:16px solid #FFFFFF;box-shadow:0 12px 36px rgba(74,42,58,0.35)"></div>', 136, 286, 808, 968, z=5),
            _text("Please forgive me", 1340, 150, 7, ink, font="Dancing Script", weight="700", fade_in=0.8, shadow="none"),
        ], bg=bg, transition="dissolve", tr_sec=1.0),
        _scene(3.0, [
            _text("Yours,", 740, 130, 7, ink, font="Dancing Script", weight="700", fade_in=0.4, shadow="none"),
            _text("{{sender}}", 880, 190, 12, accent, font="Dancing Script", weight="700", fade_in=0.9, shadow="none"),
        ], bg=bg, transition="fade", tr_sec=1.0),
    ])


# ───────────────────────────────────────────────────────────── 5. Festival (Diwali-style, saffron and gold)
def _festival() -> dict[str, Any]:
    bg, gold, saffron, glow = "#2A0F00", "#FFD166", "#FF8A1F", "rgba(255,170,40,0.6)"
    return _movie([
        _scene(3.2, [
            _glow("rgba(255,138,31,0.5)", "#2A0F00", "50% 40%"),
            _text("Shubh", 560, 160, 9, gold, font="Dancing Script", weight="700", fade_in=0.4),
            _text("{{occasion}}", 700, 200, 12, "#FFF1D0", font="Playfair Display", weight="800", style="003", fade_in=0.8),
            _text("{{name}} & family", 930, 150, 7.5, saffron, font="Poppins", weight="700", fade_in=1.4),
        ], bg=bg),
        _scene(3.0, [
            _photo(1, 120, 250, 840, 1000, zoom=2), _frame(120, 250, 840, 1000, gold, glow, radius=30),
            _text("{{fun_fact}}", 1360, 230, 5, "#FFFFFF", font="Poppins", weight="600", fade_in=0.7),
        ], bg=bg, transition="fadewhite"),
        _scene(3.0, [
            _photo(2, 0, 0, W, 1500, zoom=3, fade_in=0.3),
            _html('<div style="width:100%;height:100%;background:linear-gradient(to top, rgba(42,15,0,0.95), rgba(42,15,0,0))"></div>', 0, 1100, W, 820, z=4),
            _text("May your home glow with joy", 1500, 200, 6, gold, font="Playfair Display", weight="600", fade_in=0.6),
        ], bg=bg, transition="slideleft"),
        _scene(3.0, [
            _photo(3, 160, 330, 760, 900, zoom=2), _round(160, 330, 760, 900, bg, saffron, glow),
            _text("Happy {{occasion}}", 1330, 150, 7, gold, font="Playfair Display", weight="700", fade_in=0.6),
        ], bg=bg, transition="dissolve"),
        _scene(2.8, [
            _photo(4, 120, 260, 840, 980, zoom=2), _frame(120, 260, 840, 980, gold, glow, radius=30),
            _text("Light, love and laughter", 1350, 150, 6.4, "#FFF1D0", font="Dancing Script", weight="700", fade_in=0.6),
        ], bg=bg, transition="circleopen"),
        _scene(2.4, [
            _glow("rgba(255,138,31,0.42)", "#2A0F00", "50% 50%"),
            _text("With warm wishes,", 740, 130, 6, gold, font="Playfair Display", weight="600", fade_in=0.4),
            _text("{{sender}}", 880, 190, 11, "#FFF1D0", font="Dancing Script", weight="700", fade_in=0.9),
        ], bg=bg, transition="fadeblack"),
    ])


PRESETS: list[dict[str, Any]] = [
    {"id": "royal-birthday", "name": "Royal Birthday", "style": "bollywood", "occasion": "birthday", "photos_min": 3, "photos_max": 4,
     "description": "Gold on maroon, animated title, framed photos, a warm wish at the end.", "build": _royal_birthday},
    {"id": "romantic-anniversary", "name": "Romantic Anniversary", "style": "bollywood", "occasion": "anniversary", "photos_min": 3, "photos_max": 4,
     "description": "Rose gold, slow dissolves, polaroid and round frames, thank-you ending.", "build": _romantic_anniversary},
    {"id": "neon-party", "name": "Neon Party", "style": "genz", "occasion": "birthday", "photos_min": 3, "photos_max": 4,
     "description": "Dark with pink and cyan neon, fast slides, full-screen photos.", "build": _neon_party},
    {"id": "soft-apology", "name": "Soft Apology", "style": "retro", "occasion": "apology", "photos_min": 3, "photos_max": 3,
     "description": "A gentle pastel card with handwritten text and white photo borders.", "build": _soft_apology},
    {"id": "festival-glow", "name": "Festival Glow", "style": "bollywood", "occasion": "festival", "photos_min": 3, "photos_max": 4,
     "description": "Saffron and gold festive card (Diwali style) with glowing frames.", "build": _festival},
]


def summaries() -> list[dict[str, Any]]:
    return [{k: p[k] for k in ("id", "name", "style", "occasion", "photos_min", "photos_max", "description")} for p in PRESETS]


def get(preset_id: str) -> dict[str, Any] | None:
    for p in PRESETS:
        if p["id"] == preset_id:
            return {**{k: p[k] for k in ("id", "name", "style", "occasion", "photos_min", "photos_max", "description")}, "movie": p["build"]()}
    return None
