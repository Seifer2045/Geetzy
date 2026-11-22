"""Admin-managed template features: orientation, silent videos, template prompt, photo preview watermark."""
import io

from PIL import Image

from app.providers import elevenlabs
from app.video.json2video import MovieInput, build_movie
from app.video.watermark import PREVIEW_MAX, make_preview, shrink_photo


def _movie(kind="preview", **kw):
    base = dict(
        kind=kind, occasion="birthday", style="bollywood", recipient_name="Priya", sender_name="Rahul",
        photo_urls=[f"https://x/p{i}.jpg" for i in range(3)], audio_url="https://x/song.mp3",
    )
    return build_movie(
        MovieInput(**{**base, **kw}),
        webhook_url="https://api.example.com/webhooks/json2video?secret=s&job=j",
        client_data={"giftId": "g", "jobId": "j", "kind": kind},
    )


def test_horizontal_sizes():
    assert (_movie("preview", orientation="horizontal")["width"], _movie("preview", orientation="horizontal")["height"]) == (960, 540)
    hd = _movie("hd", orientation="horizontal")
    assert (hd["width"], hd["height"]) == (1920, 1080)


def test_vertical_is_still_the_default():
    m = _movie("hd")
    assert (m["width"], m["height"]) == (1080, 1920)


def test_horizontal_text_is_smaller():
    v = _movie("preview")["scenes"][0]["elements"][1]["settings"]["font-size"]
    h = _movie("preview", orientation="horizontal")["scenes"][0]["elements"][1]["settings"]["font-size"]
    assert float(h.removesuffix("vw")) < float(v.removesuffix("vw"))


def test_silent_video_has_no_audio_element():
    m = _movie("hd", audio_url=None)
    assert not any(e["type"] == "audio" for e in m["elements"])
    m = _movie("preview", audio_url=None)
    assert [e["type"] for e in m["elements"]] == ["text"]  # only the watermark


def test_admin_audio_prompt_reaches_elevenlabs_prompt():
    p = elevenlabs.build_prompt(direction="  retro   disco  vibes for Priya ", style="genz", mood="party", singer="duet")
    assert "retro disco vibes for Priya" in p and "duet" in p and "15 seconds" in p
    assert "retro disco" not in elevenlabs.build_prompt(direction="", style="genz")


def test_elevenlabs_prompt_is_capped():
    assert len(elevenlabs.build_prompt(direction="x" * 5000, style="genz")) <= elevenlabs.PROMPT_MAX


def _png(size=(2000, 3000)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, (200, 80, 120)).save(out, "PNG")
    return out.getvalue()


def test_preview_is_small_and_watermarked():
    original = _png()
    preview = make_preview(original)
    img = Image.open(io.BytesIO(preview))
    assert max(img.size) <= PREVIEW_MAX
    # the flat colour must have been disturbed by the tiled text
    assert len(set(img.convert("RGB").resize((60, 60)).getdata())) > 1


def test_shrink_photo_limits_size():
    out = Image.open(io.BytesIO(shrink_photo(_png((4000, 3000)))))
    assert max(out.size) <= 1280
