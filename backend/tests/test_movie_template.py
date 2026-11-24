"""Compact (older) movie template format: validator and renderer."""
import copy
import json

import pytest

from tests.samples import EXAMPLE
from app.video import movie_template as mt

GOOD = EXAMPLE


def ctx(**kw):
    base = dict(kind="preview", photo_urls=["https://p/1", "https://p/2", "https://p/3"], duration_sec=15,
                audio_url="https://a/song.mp3", values={"name": "Priya", "sender": "Rahul", "fun_fact": "loves chai", "occasion": "Birthday"})
    return mt.RenderContext(**{**base, **kw})


# ── validator
def test_the_sample_template_is_valid():
    assert mt.validate(GOOD, photos_min=1, photos_max=5) == []
    assert mt.validate(GOOD, photos_min=3, photos_max=3) == []


def _bad(mutate, **kw):
    m = copy.deepcopy(GOOD)
    mutate(m)
    return mt.validate(m, **{"photos_min": 1, "photos_max": 5, **kw})


@pytest.mark.parametrize("mutate,needle", [
    (lambda m: m["scenes"][0]["elements"].append({"type": "html", "src": "{{photo_1}}"}), "not allowed"),
    (lambda m: m["scenes"][0]["elements"][0].update(src="https://evil.example/x.png"), "no links"),
    (lambda m: m["scenes"][0]["elements"][0].update(src="{{photo_9}}"), "max photos"),
    (lambda m: m["scenes"][0]["elements"][0].update(src="{{secret}}"), "unknown marker"),
    (lambda m: m.update(exports=[{"destinations": []}]), "Unknown top-level"),
    (lambda m: m["scenes"][0].update(duration=99), "duration"),
    (lambda m: m["scenes"][1].update(transition="evil"), "transition"),
    (lambda m: m["scenes"][0]["elements"][1].update(text="x" * 500), "longer than"),
    (lambda m: m["scenes"][0]["elements"][1].update(text="{{photo_1}}"), "cannot be used in text"),
    (lambda m: m["scenes"][0]["elements"][1].update(box=[0, 0, 2, 2]), "inside the picture"),
    (lambda m: m["scenes"][0]["elements"][1].update(font="Comic Sans"), "font"),
    (lambda m: m["scenes"][0]["elements"][0].update(onclick="x"), "unknown field"),
    (lambda m: m["elements"][1].update(src="https://x/y.mp3"), "audio src"),
    (lambda m: m["scenes"][0]["elements"].append({"type": "audio", "src": "{{audio}}"}), "top-level"),
    (lambda m: m.update(scenes=[]), "at least one scene"),
])
def test_validator_rejects(mutate, needle):
    errs = _bad(mutate)
    assert errs and any(needle in e for e in errs), errs


def test_too_many_scenes_and_too_big():
    m = copy.deepcopy(GOOD)
    m["scenes"] = m["scenes"] * 6
    assert any("Too many scenes" in e for e in mt.validate(m))
    m = copy.deepcopy(GOOD)
    m["scenes"][0]["elements"][1]["text"] = "ok"
    m["pad"] = "x" * 30_000
    assert any("too big" in e for e in mt.validate(m))


def test_template_must_use_photo_1_and_survive_the_minimum():
    only_photo_2 = copy.deepcopy(GOOD)
    only_photo_2["scenes"] = [only_photo_2["scenes"][1]]
    assert any("photo_1" in e for e in mt.validate(only_photo_2))
    assert mt.validate("not json at all")  # not an object
    assert mt.validate(None)


# ── renderer
def test_markers_are_filled_and_geometry_is_in_pixels():
    body = mt.render_template(GOOD, ctx(kind="preview"))
    first = body["scenes"][0]["elements"][0]
    assert first["src"] == "https://p/1" and (first["x"], first["y"], first["width"], first["height"]) == (43, 96, 454, 480)
    hd = mt.render_template(GOOD, ctx(kind="hd"))
    assert (hd["width"], hd["height"], hd["quality"]) == (1080, 1920, "high")
    assert hd["scenes"][0]["elements"][0]["width"] == 907
    text = body["scenes"][0]["elements"][1]
    assert text["text"] == "Happy Birthday, Priya!" and text["settings"]["font-size"] == "7.5vw"
    assert body["scenes"][1]["elements"][1]["text"] == "loves chai"


def test_user_text_cannot_inject_markers_or_braces():
    body = mt.render_template(GOOD, ctx(values={"name": "{{audio}}{x}", "sender": "S", "fun_fact": "", "occasion": "B"}))
    assert body["scenes"][0]["elements"][1]["text"] == "Happy Birthday, audiox!"
    assert "{" not in json.dumps(body["scenes"][0]["elements"][1]["text"])


def test_empty_text_is_dropped():
    body = mt.render_template(GOOD, ctx(values={"name": "P", "sender": "S", "fun_fact": "", "occasion": "B"}))
    assert [e["type"] for e in body["scenes"][1]["elements"]] == ["image"]  # {{fun_fact}} was empty


def test_fewer_photos_drop_scenes_and_keep_the_total_length():
    for n in (1, 2, 3):
        body = mt.render_template(GOOD, ctx(photo_urls=[f"https://p/{i}" for i in range(n)]))
        assert len(body["scenes"]) == n
        overlap = mt.TRANSITION_SEC * (n - 1)
        assert abs(sum(s["duration"] for s in body["scenes"]) - overlap - 15) < 0.01


def test_audio_background_and_art_are_optional_markers():
    silent = mt.render_template(GOOD, ctx(audio_url=None))
    assert not any(e["type"] == "audio" for e in silent["elements"])
    with_audio = mt.render_template(GOOD, ctx(audio_seek=12.5))
    audio = next(e for e in with_audio["elements"] if e["type"] == "audio")
    assert audio["src"] == "https://a/song.mp3" and audio["seek"] == 12.5 and audio["duration"] == 15 and audio["fade-in"] == 0.3
    assert not any(e.get("src") == "x" for e in with_audio["elements"])
    with_bg = mt.render_template(GOOD, ctx(background_url="https://bg/x.jpg"))
    assert any(e.get("src") == "https://bg/x.jpg" for e in with_bg["elements"])  # no background url -> element removed


def test_watermark_only_on_preview_and_only_when_asked():
    texts = lambda b: [e["text"] for e in b["elements"] if e["type"] == "text"]  # noqa: E731
    assert texts(mt.render_template(GOOD, ctx(kind="preview"))) == ["GEETZY · PREVIEW"]
    assert texts(mt.render_template(GOOD, ctx(kind="preview", watermark=False))) == []
    assert texts(mt.render_template(GOOD, ctx(kind="hd"))) == []


def test_no_photos_is_an_error():
    with pytest.raises(mt.MovieTemplateError):
        mt.render_template(GOOD, ctx(photo_urls=[]))


# ── song is always played, text always fits, design is frozen per gift
def test_song_is_played_even_if_grok_forgot_the_audio_element():
    m = copy.deepcopy(GOOD)
    m["elements"] = [e for e in m["elements"] if e["type"] != "audio"]
    assert mt.validate(m, photos_min=3, photos_max=5) == []  # valid on purpose: the renderer fixes it
    body = mt.render_template(m, ctx(audio_url="https://a/paid-song.mp3", audio_seek=4))
    audio = [e for e in body["elements"] if e["type"] == "audio"]
    assert len(audio) == 1 and audio[0]["src"] == "https://a/paid-song.mp3" and audio[0]["seek"] == 4
    assert not any(e["type"] == "audio" for e in mt.render_template(m, ctx(audio_url=None))["elements"])  # silent stays silent


def test_only_one_audio_element_when_template_has_one():
    body = mt.render_template(GOOD, ctx())
    assert sum(e["type"] == "audio" for e in body["elements"]) == 1


def test_long_text_shrinks_to_fit_its_box_and_short_text_is_untouched():
    box, canvas = [0.05, 0.66, 0.9, 0.16], (540, 960)
    assert mt.fit_font_size("Happy Birthday!", 0.05, box, canvas) == 0.05
    long = mt.fit_font_size("x" * 120, 0.09, box, canvas)
    assert mt.MIN_FONT <= long < 0.09
    lines = -(-120 // max(1, int(box[2] / (mt.CHAR_WIDTH * long))))
    assert lines * mt.LINE_HEIGHT * long <= box[3] * canvas[1] / canvas[0] + 1e-9
    assert mt.fit_font_size("x" * 5000, 0.2, box, canvas) == mt.MIN_FONT  # never below the floor, never loops forever


def test_rendered_font_size_is_same_at_preview_and_hd():
    values = {"name": "Priyadarshini Venkataraman", "sender": "S", "fun_fact": "y" * 120, "occasion": "B"}
    sizes = {k: [e["settings"]["font-size"] for s in mt.render_template(GOOD, ctx(kind=k, values=values))["scenes"]
                 for e in s["elements"] if e["type"] == "text"] for k in ("preview", "hd")}
    assert sizes["preview"] == sizes["hd"]


def test_gift_renders_from_its_frozen_design_not_the_live_template():
    from app import pipeline
    live = {"id": "t1", "song_mode": "ai", "movie_json": {"scenes": "NEW GROK DESIGN"}, "duration_sec": 15, "updated_at": "2026-11-26"}
    frozen = {"movie_json": GOOD, "duration_sec": 15, "updated_at": "2026-11-20", "song_mode": "none", "id": "evil"}
    out = pipeline.with_frozen_design(live, {"design": frozen})
    assert out["movie_json"] is GOOD and out["updated_at"] == "2026-11-20"
    assert out["song_mode"] == "ai" and out["id"] == "t1"  # only look-defining keys are copied
    assert pipeline.with_frozen_design(live, {"design": None}) is live  # gifts made before the migration
    assert pipeline.with_frozen_design(live, {}) is live


# ── the title can never be hidden
def _text_of(body):
    return [e for s in body["scenes"] for e in s["elements"] if e["type"] == "text"]


def test_text_is_always_above_the_frame_even_with_a_small_z():
    movie = copy.deepcopy(GOOD)
    for sc in movie["scenes"]:
        for e in sc["elements"]:
            if e["type"] == "text":
                e["z"] = 5
    body = mt.render_template(movie, ctx(art_url="https://a/art.png"))
    assert _text_of(body) and all(t["z-index"] >= mt.TEXT_MIN_Z > mt.ART_Z for t in _text_of(body))


def _with_art(title_first=True):
    movie = copy.deepcopy(GOOD)
    title = {"duration": 2, "elements": [{"type": "text", "text": "HAPPY ANNIVERSARY", "box": [0.05, 0.4, 0.9, 0.15], "size": 0.09, "z": 5}]}
    movie["scenes"].insert(0, title)
    movie["elements"] = [e for e in movie.get("elements", []) if e["src" if "src" in e else "type"] != "{{background}}"]
    movie["elements"].append({"type": "image", "src": "{{art}}", "box": [0, 0, 1, 1], "z": 10})
    return movie


def test_the_frame_is_only_drawn_on_scenes_with_a_photo():
    body = mt.render_template(_with_art(), ctx(art_url="https://a/art.png"))
    art_in_scene = [any(e.get("src") == "https://a/art.png" for e in s["elements"]) for s in body["scenes"]]
    assert art_in_scene == [False, True, True, True]  # the title scene has no frame, so its background and title show
    assert not any(e.get("src") == "https://a/art.png" for e in body["elements"])  # and it is not movie-wide any more


def test_user_photos_stay_under_the_frame():
    body = mt.render_template(_with_art(), ctx(art_url="https://a/art.png"))
    for s in body["scenes"]:
        photos = [e for e in s["elements"] if e["type"] == "image" and e["src"].startswith("https://p/")]
        art = [e for e in s["elements"] if e.get("src") == "https://a/art.png"]
        assert all(p["z-index"] < a["z-index"] for p in photos for a in art)


def test_the_background_picture_is_added_when_the_template_forgot_it():
    movie = copy.deepcopy(GOOD)
    movie["elements"] = [e for e in movie["elements"] if e.get("src") != "{{background}}"]
    body = mt.render_template(movie, ctx(background_url="https://bg/pic.jpg"))
    bg = [e for e in body["elements"] if e.get("src") == "https://bg/pic.jpg"]
    assert len(bg) == 1 and bg[0]["z-index"] == 0 and bg[0]["width"] == 540 and bg[0]["height"] == 960


def test_the_background_picture_is_not_added_twice_or_over_a_frame():
    body = mt.render_template(GOOD, ctx(background_url="https://bg/pic.jpg"))
    assert sum(1 for e in body["elements"] if e.get("src") == "https://bg/pic.jpg") == 1
    framed = mt.render_template(_with_art(), ctx(background_url="https://bg/pic.jpg", art_url="https://a/art.png"))
    assert not any(e.get("src") == "https://bg/pic.jpg" for e in framed["elements"])
