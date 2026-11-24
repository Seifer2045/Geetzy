"""Native JSON2Video templates (what the Editor exports + our placeholders) and the starter templates."""
import copy
import json

import pytest

from app.services import render_body
from app.video import native_template as nt
from app.video import presets
from app.video.movie_template import MovieTemplateError, RenderContext
from tests.samples import EXAMPLE

PHOTOS = [f"https://p/{k}.jpg" for k in range(1, 5)]


def good():
    return presets.get("royal-birthday")["movie"]


def ctx(**kw):
    base = dict(kind="preview", photo_urls=PHOTOS, duration_sec=15, audio_url="https://a/song.mp3",
                values={"name": "Animesh", "sender": "Rahul", "fun_fact": "loves chai", "occasion": "Birthday"}, watermark=False)
    return RenderContext(**{**base, **kw})


def scene(*elements, duration=3.0, **kw):
    return {"duration": duration, "elements": list(elements), **kw}


def photo_el(k=1, **kw):
    return {"type": "image", "src": f"{{{{photo_{k}}}}}", "position": "custom", "x": 100, "y": 200, "width": 800, "height": 900, **kw}


def text_el(t="Hi {{name}}", **kw):
    return {"type": "text", "text": t, "position": "custom", "x": 0, "y": 1300, "width": 1080, "height": 200, **kw}


# ───────────────────────────────────────────────────────────── format detection
def test_native_vs_compact_is_told_apart():
    assert nt.is_native(good())
    assert not nt.is_native(EXAMPLE)          # fractions + box = the older compact format
    assert not nt.is_native("nope") and not nt.is_native(None)


# ───────────────────────────────────────────────────────────── validation
def test_every_starter_template_is_valid_for_its_photo_range():
    for p in presets.PRESETS:
        movie = presets.get(p["id"])["movie"]
        assert nt.validate(movie, photos_min=p["photos_min"], photos_max=p["photos_max"]) == [], p["id"]
        assert nt.validate(movie, photos_min=1, photos_max=p["photos_max"]) == [], p["id"]  # works with a single photo too


def test_starters_are_listed_and_fetchable():
    listed = presets.summaries()
    assert len(listed) == 5 and {p["id"] for p in listed} >= {"royal-birthday", "romantic-anniversary", "neon-party", "soft-apology", "festival-glow"}
    assert all("movie" not in p for p in listed)
    assert presets.get("nope") is None and presets.get("neon-party")["movie"]["scenes"]


def bad(mutate, **kw):
    m = copy.deepcopy(good())
    mutate(m)
    return nt.validate(m, **{"photos_min": 3, "photos_max": 4, **kw})


@pytest.mark.parametrize("mutate,needle", [
    (lambda m: m.update(width=720, height=1280), "canvas must be 1080 x 1920"),
    (lambda m: m.update(exports=[{"destinations": []}]), "not allowed top-level"),
    (lambda m: m.update(**{"client-data": {"x": 1}}), "not allowed top-level"),
    (lambda m: m["scenes"][0].update(duration=-1), "'duration' must be a number"),
    (lambda m: m["scenes"][0].update(duration=99), "'duration' must be a number"),
    (lambda m: m["scenes"][1].update(transition={"style": "zoomin", "duration": 1}), "not one of JSON2Video's styles"),
    (lambda m: m["scenes"][1].update(iterate="photos"), "'iterate' is not supported"),
    (lambda m: m["scenes"][1].update(condition="{{ x }}"), "'condition' is not supported"),
    (lambda m: m["scenes"][0]["elements"][1].update(text="{{price}} off"), "cannot be used here"),
    (lambda m: m["scenes"][0]["elements"][1].update(text="{{ name > 3 }}"), "not one of the placeholders"),
    (lambda m: m["scenes"][1]["elements"][0].update(src="{{photo_9}}"), "more than the template's max photos"),
    (lambda m: m["scenes"][1]["elements"][0].update(src="http://insecure/x.jpg"), "https"),
    (lambda m: m["scenes"][1]["elements"][0].update(src="x {{photo_1}} y"), "exactly one placeholder"),
    (lambda m: m["scenes"][0]["elements"].append({"type": "image", "src": "https://x/y.png", "alt": "{{name}}"}), "not allowed"),
    (lambda m: m["scenes"][0]["elements"].append({"type": "subtitles"}), "not supported"),
    (lambda m: m["scenes"][0]["elements"].append({"type": "html", "html": "<script>alert(1)</script>"}), "scripts"),
    (lambda m: m["scenes"][0]["elements"].append({"type": "text", "text": "x" * 500}), "longer than"),
    (lambda m: m["scenes"][0]["elements"].append({"type": "audio", "src": "{{photo_1}}"}), "audio src"),
    (lambda m: m["scenes"][0]["elements"].append({"type": "video", "src": "{{photo_1}}"}), "https link"),
    (lambda m: m.update(scenes=[]), "at least one scene"),
])
def test_validator_rejects(mutate, needle):
    errs = bad(mutate)
    assert errs and any(needle in e for e in errs), errs


def test_a_template_must_show_photo_1_and_survive_the_minimum():
    only_text = {"scenes": [scene(text_el("{{name}}"))]}
    assert any("no user photo" in e for e in nt.validate(only_text))
    no_first = {"scenes": [scene(photo_el(2))]}
    assert any("{{photo_1}}" in e for e in nt.validate(no_first, photos_min=2, photos_max=3))
    needs_two = {"scenes": [scene(photo_el(1), photo_el(2))]}  # every scene wants photo 2, so one photo leaves nothing to show
    assert any("breaks" in e for e in nt.validate(needs_two, photos_min=1, photos_max=3))


def test_not_an_object_or_too_big():
    assert nt.validate([1, 2]) and nt.validate("x")
    huge = {"scenes": [scene(photo_el(1), text_el("x"))], "comment": "y" * 70_000}
    assert any("too big" in e for e in nt.validate(huge))


# ───────────────────────────────────────────────────────────── rendering
def test_placeholders_are_all_replaced_and_the_body_is_sized_by_us():
    body = nt.render(good(), ctx())
    text = json.dumps(body, ensure_ascii=False)
    assert "{{" not in text and "Animesh" in text and "loves chai" in text and "Rahul" in text
    assert (body["width"], body["height"], body["resolution"]) == (1080, 1920, "custom") and body["quality"] == "medium"
    assert body["scenes"][0]["elements"] and all(isinstance(s["duration"], float) for s in body["scenes"])


def test_hd_uses_the_same_canvas_with_higher_quality():
    body = nt.render(good(), ctx(kind="hd"))
    assert (body["width"], body["height"], body["quality"]) == (1080, 1920, "high")


def test_user_photos_replace_the_placeholders_in_order():
    body = nt.render(good(), ctx())
    used = [e["src"] for s in body["scenes"] for e in s["elements"] if e["type"] == "image"]
    assert used[:4] == PHOTOS and all(not u.startswith("{{") for u in used)


def test_the_cut_for_a_frame_is_used_when_there_is_one():
    movie = {"scenes": [scene(photo_el(1))]}
    frame = nt._frame_px(movie["scenes"][0]["elements"][0])
    body = nt.render(movie, ctx(photo_variants={nt.variant_key(1, frame): "https://cut/1.jpg"}, photo_urls=PHOTOS[:1]))
    assert body["scenes"][0]["elements"][0]["src"] == "https://cut/1.jpg"


def test_a_boxed_photo_never_keeps_resize_cover_because_json2video_would_ignore_its_box():
    movie = {"scenes": [scene(photo_el(1, resize="cover"))]}
    body = nt.render(movie, ctx(photo_urls=PHOTOS[:1]))
    el = body["scenes"][0]["elements"][0]
    assert "resize" not in el and (el["width"], el["height"]) == (800, 900)


def test_a_photo_without_geometry_fills_the_canvas():
    movie = {"scenes": [scene({"type": "image", "src": "{{photo_1}}"})]}
    el = nt.render(movie, ctx(photo_urls=PHOTOS[:1]))["scenes"][0]["elements"][0]
    assert (el["x"], el["y"], el["width"], el["height"]) == (0, 0, 1080, 1920)


def test_fewer_photos_drop_scenes_and_keep_the_total_length():
    body3 = nt.render(good(), ctx(photo_urls=PHOTOS[:3]))
    body4 = nt.render(good(), ctx())
    assert len(body3["scenes"]) == len(body4["scenes"]) - 1
    for body in (body3, body4):
        overlaps = sum(s["transition"]["duration"] for s in body["scenes"][1:] if "transition" in s)
        assert sum(s["duration"] for s in body["scenes"]) - overlaps == pytest.approx(15, abs=0.05)


def test_element_timings_follow_the_scene_stretch():
    movie = {"scenes": [scene(photo_el(1), text_el("a", start=1.0, duration=2.0), duration=3.0), scene(text_el("b"), duration=3.0)]}
    body = nt.render(movie, ctx(photo_urls=PHOTOS[:1], duration_sec=12))
    stretched = body["scenes"][0]["elements"][1]
    assert body["scenes"][0]["duration"] == pytest.approx(6.0) and stretched["start"] == pytest.approx(2.0) and stretched["duration"] == pytest.approx(4.0)


def test_empty_text_is_dropped_and_user_text_cannot_inject_markers():
    movie = {"scenes": [scene(photo_el(1), text_el("{{fun_fact}}"), text_el("{{name}}"))]}
    body = nt.render(movie, ctx(photo_urls=PHOTOS[:1], values={"name": "{{audio}}x", "sender": "", "fun_fact": "", "occasion": ""}))
    texts = [e["text"] for e in body["scenes"][0]["elements"] if e["type"] == "text"]
    assert texts == ["audiox"] and "{{" not in json.dumps(body)


def test_user_text_is_escaped_inside_html_layers():
    movie = {"scenes": [scene(photo_el(1), {"type": "html", "html": "<div style=\"width:10px;height:10px\">{{name}}</div>", "position": "custom",
                                            "x": 0, "y": 0, "width": 100, "height": 100})]}
    html = nt.render(movie, ctx(photo_urls=PHOTOS[:1], values={"name": "<b onclick=x>Hi</b>", "sender": "", "fun_fact": "", "occasion": ""}))["scenes"][0]["elements"][1]["html"]
    assert "<b" not in html and "&lt;b" in html


def test_the_song_is_added_with_seek_fade_and_length_even_without_an_audio_element():
    movie = {"scenes": [scene(photo_el(1))]}
    audio = [e for e in nt.render(movie, ctx(photo_urls=PHOTOS[:1], audio_seek=12.5, fade=True))["elements"] if e["type"] == "audio"]
    assert len(audio) == 1 and audio[0]["src"] == "https://a/song.mp3" and audio[0]["seek"] == 12.5 and audio[0]["duration"] == 15
    assert audio[0]["fade-out"] == 1.2 and audio[0]["fade-in"] == 0.3


def test_only_one_song_when_the_template_has_an_audio_element_and_none_when_silent():
    body = nt.render(good(), ctx())
    assert sum(1 for e in body["elements"] if e["type"] == "audio") == 1
    silent = nt.render(good(), ctx(audio_url=None))
    assert not any(e["type"] == "audio" for e in silent["elements"])


def test_the_name_is_spoken_from_the_song_spec_when_the_template_has_no_voice():
    slots = [{"at": 3.3, "text": "{{name}}", "volume": 1.0}]
    voices = [e for e in nt.render(good(), ctx(song_slots=slots))["elements"] if e["type"] == "voice"]
    assert len(voices) == 1 and voices[0]["text"] == "Animesh" and voices[0]["start"] == 3.3 and "voice" in voices[0]


def test_a_template_voice_wins_over_the_spec():
    movie = {"scenes": [scene(photo_el(1))], "elements": [{"type": "voice", "text": "{{name}}", "start": 2}]}
    body = nt.render(movie, ctx(photo_urls=PHOTOS[:1], song_slots=[{"at": 5, "text": "{{name}}", "volume": 1}]))
    voices = [e for e in body["elements"] if e["type"] == "voice"]
    assert len(voices) == 1 and voices[0]["start"] == 2.0


def test_watermark_only_on_previews_when_asked():
    assert any(e.get("z-index") == nt.WATERMARK_Z for e in nt.render(good(), ctx(watermark=True))["elements"])
    assert not any(e.get("z-index") == nt.WATERMARK_Z for e in nt.render(good(), ctx(watermark=False))["elements"])
    assert not any(e.get("z-index") == nt.WATERMARK_Z for e in nt.render(good(), ctx(kind="hd", watermark=True))["elements"])


def test_background_picture_is_used_where_the_template_asks_and_added_when_it_does_not():
    with_marker = {"scenes": [scene(photo_el(1))], "elements": [{"type": "image", "src": "{{background}}"}]}
    body = nt.render(with_marker, ctx(photo_urls=PHOTOS[:1], background_url="https://bg/pic.jpg"))
    assert sum(1 for e in body["elements"] if e.get("src") == "https://bg/pic.jpg") == 1
    without = nt.render({"scenes": [scene(photo_el(1))]}, ctx(photo_urls=PHOTOS[:1], background_url="https://bg/pic.jpg"))
    assert without["elements"][0]["src"] == "https://bg/pic.jpg" and without["elements"][0]["z-index"] == 0
    none = nt.render(with_marker, ctx(photo_urls=PHOTOS[:1], background_url=None))
    assert not any(e.get("src") == "{{background}}" for e in none["elements"])


def test_no_photos_or_no_usable_scene_is_an_error():
    with pytest.raises(MovieTemplateError):
        nt.render(good(), ctx(photo_urls=[]))
    with pytest.raises(MovieTemplateError):
        nt.render({"scenes": [scene(photo_el(3))]}, ctx(photo_urls=PHOTOS[:1]))


# ───────────────────────────────────────────────────────────── photo frames (face-aware cuts)
def test_photo_frames_use_the_element_size_or_the_whole_canvas():
    movie = {"scenes": [scene(photo_el(1), {"type": "image", "src": "{{photo_2}}"}, photo_el(3, resize="contain"), photo_el(9))]}
    assert nt.photo_frames(movie, n_photos=4) == {1: {(800, 900)}, 2: {(1080, 1920)}}


def test_every_frame_the_renderer_uses_is_one_we_cut():
    movie = good()
    frames = nt.photo_frames(movie, n_photos=4)
    keys = {nt.variant_key(k, f) for k, sizes in frames.items() for f in sizes}
    body = nt.render(movie, ctx(photo_variants={k: f"https://cut/{k}" for k in keys}))
    used = [e["src"] for s in body["scenes"] for e in s["elements"] if e["type"] == "image"]
    assert used and all(u.startswith("https://cut/") for u in used)


# ───────────────────────────────────────────────────────────── choosing the renderer
TPL = {"id": "T", "duration_sec": 15, "color_from": "#FF4D8D", "color_to": "#000000", "style": "bollywood", "render_config": {}, "orientation": "vertical"}


def body_for(movie, **kw):
    return render_body.movie_body(
        {**TPL, "movie_json": movie}, kind="preview", occasion="Birthday", recipient="Animesh", sender="Rahul", fun_fact="x",
        photo_urls=PHOTOS, audio_url="https://a/song.mp3", audio_seek=0, fade=True, lyric_lines=[], art_url=None, background_url=None,
        slot=None, watermark=False, webhook_url="https://api/hook", client_data={"giftId": "g"}, **kw)


def test_the_renderer_follows_the_template_format():
    native = body_for(good())
    assert (native["width"], native["height"]) == (1080, 1920) and native["exports"][0]["destinations"][0]["endpoint"] == "https://api/hook"
    assert native["client-data"] == {"giftId": "g"}
    compact = body_for(EXAMPLE)
    assert (compact["width"], compact["height"]) == (540, 960)  # the older compact format keeps its own sizes
    builtin = body_for(None)
    assert builtin["scenes"] and "exports" in builtin


def test_a_broken_template_falls_back_to_the_built_in_design():
    broken = {"scenes": [scene(photo_el(1))]}
    broken["scenes"][0]["elements"][0]["src"] = "{{photo_1}}"
    body = body_for({"scenes": [{"duration": 3, "elements": []}], "width": 1080})  # no photo scene at all
    assert body["scenes"] and "exports" in body


def test_photo_frames_choice_matches_the_renderer_choice():
    f_native = render_body.photo_frames({**TPL, "movie_json": good()}, n_photos=4, studio_art=False, slot=None)
    assert f_native and all(isinstance(w, int) for sizes in f_native.values() for w, _ in sizes)
    f_builtin = render_body.photo_frames({**TPL, "movie_json": None}, n_photos=2, studio_art=False, slot=None)
    assert f_builtin == {1: {(1080, 1920)}, 2: {(1080, 1920)}}


# ───────────────────────────────────────────────────────────── HTTP: the admin's starter list and Validate button
from fastapi.testclient import TestClient  # noqa: E402

from app import main  # noqa: E402

API = TestClient(main.app)
AUTH = {"x-internal-secret": "internal-test"}


def test_presets_endpoints_need_the_internal_secret_and_return_the_starters():
    assert API.get("/internal/presets").status_code in (401, 403)
    listed = API.get("/internal/presets", headers=AUTH).json()["presets"]
    assert len(listed) == 5 and "movie" not in listed[0]
    one = API.get("/internal/presets/royal-birthday", headers=AUTH).json()
    assert one["name"] == "Royal Birthday" and one["movie"]["scenes"] and one["photos_max"] == 4
    assert API.get("/internal/presets/nope", headers=AUTH).status_code == 404


def test_validate_endpoint_understands_both_formats():
    ok = API.post("/internal/movie/validate", headers=AUTH, json={"movie": good(), "photos_min": 3, "photos_max": 4}).json()
    assert ok == {"errors": []}
    compact = API.post("/internal/movie/validate", headers=AUTH, json={"movie": EXAMPLE, "photos_min": 1, "photos_max": 3}).json()
    assert compact == {"errors": []}
    broken = good()
    broken["width"], broken["height"] = 720, 1280
    errs = API.post("/internal/movie/validate", headers=AUTH, json={"movie": broken, "photos_min": 3, "photos_max": 4}).json()["errors"]
    assert errs and "1080 x 1920" in errs[0]
    assert API.post("/internal/movie/validate", headers=AUTH, json={"movie": "not json", "photos_min": 1, "photos_max": 3}).json()["errors"]
