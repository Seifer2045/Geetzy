"""Photos are cut for the frame they are shown in, with the face placed well; renderer uses the cuts and never pans user photos."""
import io

import pytest
from PIL import Image, ImageDraw

from app.services import photo_prep, render_body
from app.video import framing
from app.video import json2video as j2v
from app.video import movie_template as mt
from tests.samples import EXAMPLE

NINE_SIXTEEN = (1080, 1920)


def _aspect(box):
    return (box[2] - box[0]) / (box[3] - box[1])


# ------------------------------------------------------------------ crop window
@pytest.mark.parametrize("photo", [(1000, 1500), (1500, 1000), (1000, 1000), (4000, 3000), (600, 1800)])
@pytest.mark.parametrize("frame", [(1080, 1920), (1920, 1080), (907, 960), (1000, 1000)])
def test_window_has_the_frames_aspect_and_stays_inside_the_photo(photo, frame):
    img = Image.new("RGB", photo, "white")
    for faces in ([], [(photo[0] * 0.1, photo[1] * 0.1, 80, 100)], [(photo[0] * 0.8, photo[1] * 0.7, 90, 110)]):
        box = framing.plan_window(img, frame, faces)
        assert 0 <= box[0] < box[2] <= photo[0] and 0 <= box[1] < box[3] <= photo[1]
        assert _aspect(box) == pytest.approx(frame[0] / frame[1], rel=0.01)


def test_a_face_lands_slightly_above_the_middle_when_the_photo_allows_it():
    # a wide photo into a tall frame: plenty of room sideways, so the face can be centred across
    face = (1400, 700, 200, 260)
    box = framing.face_window((3000, 2000), 9 / 16, [face])
    ww, wh = box[2] - box[0], box[3] - box[1]
    focus_x = face[0] + face[2] / 2
    assert (focus_x - box[0]) / ww == pytest.approx(0.5, abs=0.02)
    head_mid = (face[1] - framing.HEAD_UP * face[3] + face[1] + face[3]) / 2
    assert (head_mid - box[1]) / wh == pytest.approx(framing.ANCHOR_Y, abs=0.03)


def test_a_face_at_the_edge_is_moved_as_far_as_possible_but_never_cut():
    face = (20, 100, 150, 190)  # hugging the left edge
    box = framing.face_window((3000, 2000), 9 / 16, [face])
    assert box[0] == 0 and box[0] <= face[0] and box[2] >= face[0] + face[2]


def test_a_group_keeps_every_face_inside():
    faces = [(900, 600, 160, 200), (1500, 650, 170, 210), (2000, 580, 150, 190)]
    box = framing.face_window((3200, 2000), 1.0, faces)
    for x, y, w, h in faces:
        assert box[0] <= x and x + w <= box[2] and box[1] <= y and y + h <= box[3]


def test_photo_with_the_frames_exact_aspect_is_not_cut():
    img = Image.new("RGB", (900, 1600), "white")
    assert framing.plan_window(img, NINE_SIXTEEN, []) == (0, 0, 900, 1600)


# ------------------------------------------------------------------ smart crop (no face)
def test_smart_crop_prefers_the_busy_part_over_a_plain_one():
    img = Image.new("RGB", (3000, 1000), "#808080")
    draw = ImageDraw.Draw(img)
    for x in range(2200, 2900, 40):  # lots of edges on the right side only
        draw.rectangle((x, 100, x + 20, 900), fill="black")
    box = framing.smart_window(img, 9 / 16)
    assert box[0] > 1200 and box[2] - box[0] == pytest.approx(562, abs=3)


def test_smart_crop_of_a_plain_photo_stays_central():
    img = Image.new("RGB", (3000, 1000), "#808080")
    box = framing.smart_window(img, 9 / 16)
    assert abs((box[0] + box[2]) / 2 - 1500) < 400


# ------------------------------------------------------------------ the image file
def test_variant_has_the_frame_aspect_and_is_never_upscaled():
    img = Image.new("RGB", (1200, 900), "#336699")
    data = framing.render_variant(img, NINE_SIXTEEN, [(500, 300, 120, 150)])
    out = Image.open(io.BytesIO(data))
    assert out.format == "JPEG"
    assert out.width / out.height == pytest.approx(9 / 16, abs=0.01)
    assert out.height <= 900  # cut from a 900 px tall photo: not stretched to 1920


def test_big_photo_is_resized_down_to_exactly_the_frame():
    img = Image.new("RGB", (4000, 3000), "#336699")
    out = Image.open(io.BytesIO(framing.render_variant(img, (1080, 1080), [])))
    assert out.size == (1080, 1080)


def test_plain_jpeg_is_a_clean_upright_copy():
    img = Image.new("RGB", (3000, 2000), "white")
    out = Image.open(io.BytesIO(framing.plain_jpeg(img)))
    assert max(out.size) <= 1920 and out.format == "JPEG"


# ------------------------------------------------------------------ frames the renderer will use
def test_photo_frames_match_what_the_renderer_asks_for():
    movie = EXAMPLE
    frames = mt.photo_frames(movie, n_photos=3)
    assert set(frames) == {1, 2, 3}
    for sizes in frames.values():
        assert all(w > 0 and h > 0 for w, h in sizes)
    box = movie["scenes"][1]["elements"][0]["box"]
    assert (round(box[2] * 1080), round(box[3] * 1920)) in frames[1]


def test_photos_beyond_the_count_and_non_cover_fits_get_no_frame():
    m = {"scenes": [{"duration": 3, "elements": [
        {"type": "image", "src": "{{photo_1}}", "box": [0, 0, 1, 1]},
        {"type": "image", "src": "{{photo_2}}", "box": [0, 0, 1, 1], "fit": "contain"},
        {"type": "image", "src": "{{photo_4}}", "box": [0, 0, 1, 1]},
    ]}]}
    assert mt.photo_frames(m, n_photos=3) == {1: {(1080, 1920)}}


def test_renderer_uses_the_cut_for_its_frame_and_never_pans_user_photos():
    movie = EXAMPLE
    frame = next(iter(mt.photo_frames(movie, n_photos=3)[1]))
    key = f"1:{frame[0]}x{frame[1]}"
    ctx = mt.RenderContext(kind="preview", photo_urls=["https://p/1", "https://p/2", "https://p/3"], audio_url=None,
                           values={"name": "Priya"}, photo_variants={key: "https://cut/1.jpg"})
    body = mt.render_template(movie, ctx)
    images = [e for s in body["scenes"] for e in s["elements"] if e["type"] == "image"]
    assert any(e["src"] == "https://cut/1.jpg" for e in images)
    assert any(e["src"] == "https://p/2" for e in images)  # no cut for photo 2: plain url
    assert all("pan" not in e and e.get("zoom") for e in images)


def test_builtin_design_uses_cuts_and_no_pan():
    base = dict(kind="preview", occasion="birthday", style="bollywood", recipient_name="Priya", sender_name="Rahul",
                photo_urls=["https://p/1", "https://p/2"], duration_sec=15)
    key = "1:1080x1920"
    movie = j2v.build_movie(j2v.MovieInput(**base, photo_variants={key: "https://cut/1.jpg"}), webhook_url="https://w", client_data={})
    photos = [e for s in movie["scenes"] for e in s["elements"] if e["type"] == "image"]
    assert photos[0]["src"] == "https://cut/1.jpg" and photos[1]["src"] == "https://p/2"
    assert all("pan" not in p for p in photos)


def test_render_body_frames_follow_the_same_choice_as_the_render():
    tpl = {"id": "T", "movie_json": None, "orientation": "vertical"}
    frames = render_body.photo_frames(tpl, n_photos=2, studio_art=False, slot=None)
    assert frames == {1: {(1080, 1920)}, 2: {(1080, 1920)}}
    wide = render_body.photo_frames({**tpl, "orientation": "horizontal"}, n_photos=1, studio_art=False, slot=None)
    assert wide == {1: {(1920, 1080)}}


# ------------------------------------------------------------------ photo_prep (storage and faces mocked)
@pytest.fixture
def store(monkeypatch):
    files: dict[str, bytes] = {}
    img = Image.new("RGB", (1600, 1200), "#cc8844")
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    monkeypatch.setattr(photo_prep, "signed_url", lambda bucket, path: f"https://s/{bucket}/{path}" if (bucket == "gift-uploads" or path in files) else (_ for _ in ()).throw(RuntimeError("404")))
    monkeypatch.setattr(photo_prep, "upload_bytes", lambda bucket, path, data, ct: files.__setitem__(path, data) or path)
    monkeypatch.setattr(photo_prep, "_load", lambda url: img.copy())
    monkeypatch.setattr(photo_prep.face_finder, "find_faces", lambda im: [(700, 300, 160, 200)])
    return files


def test_prepare_makes_one_file_per_frame_and_reuses_them(store):
    frames = {1: {(1080, 1920), (907, 960)}, 2: {(1080, 1920)}}
    out = photo_prep.prepare_photos("u1", "g1", ["u1/a/photo-1.jpg", "u1/a/photo-2.jpg"], frames)
    assert set(out.variants) == {"1:1080x1920", "1:907x960", "2:1080x1920"}
    assert "u1/g1/clean/1-1080x1920.jpg" in store and "u1/g1/clean/2.jpg" in store
    before = dict(store)
    again = photo_prep.prepare_photos("u1", "g1", ["u1/a/photo-1.jpg", "u1/a/photo-2.jpg"], frames)
    assert again.variants == out.variants and store == before  # the HD render / a retry reuses the files


def test_prepare_falls_back_to_the_original_when_nothing_works(store, monkeypatch):
    monkeypatch.setattr(photo_prep, "_load", lambda url: (_ for _ in ()).throw(RuntimeError("bad file")))
    out = photo_prep.prepare_photos("u1", "g1", ["u1/a/photo-1.jpg"], {1: {(1080, 1920)}})
    assert out.variants == {} and out.urls == ["https://s/gift-uploads/u1/a/photo-1.jpg"]


def test_one_bad_frame_does_not_lose_the_others(store, monkeypatch):
    real = framing.render_variant

    def flaky(img, frame, faces):
        if frame == (907, 960):
            raise RuntimeError("boom")
        return real(img, frame, faces)

    monkeypatch.setattr(photo_prep.framing, "render_variant", flaky)
    out = photo_prep.prepare_photos("u1", "g1", ["u1/a/photo-1.jpg"], {1: {(1080, 1920), (907, 960)}})
    assert set(out.variants) == {"1:1080x1920"}
