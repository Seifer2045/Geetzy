import pytest

from app.ai.gemini import song_prompt
from app.video.json2video import TRANSITION_SEC, MovieInput, build_movie


def movie(kind="preview", photos=3, seek=0.0, lines=None):
    return build_movie(
        MovieInput(
            kind=kind, occasion="birthday", style="bollywood", recipient_name="Priya", sender_name="Rahul",
            photo_urls=[f"https://x/p{i}.jpg" for i in range(photos)], audio_url="https://x/song.mp3",
            audio_seek=seek, lyric_lines=lines or [],
        ),
        webhook_url="https://api.example.com/webhooks/json2video?secret=s&job=j",
        client_data={"giftId": "g", "jobId": "j", "kind": kind},
    )


@pytest.mark.parametrize("photos", [3, 4, 5])
def test_total_length_is_15_seconds(photos):
    m = movie(photos=photos)
    scenes = m["scenes"]
    total = sum(s["duration"] for s in scenes) - (len(scenes) - 1) * TRANSITION_SEC
    assert total == pytest.approx(15, abs=0.01)
    assert "transition" not in scenes[0]
    assert all("transition" in s for s in scenes[1:])


def test_preview_has_watermark_and_small_size():
    m = movie("preview")
    assert (m["width"], m["height"]) == (540, 960)
    assert any(e["type"] == "text" and "PREVIEW" in e["text"] for e in m["elements"])


def test_hd_has_no_watermark_and_full_size():
    m = movie("hd")
    assert (m["width"], m["height"]) == (1080, 1920)
    assert not any(e["type"] == "text" for e in m["elements"])


def test_audio_seek_and_webhook():
    m = movie(seek=42.5)
    audio = next(e for e in m["elements"] if e["type"] == "audio")
    assert audio["seek"] == 42.5 and audio["duration"] == 15
    assert m["exports"] == [{"destinations": [{"type": "webhook", "endpoint": "https://api.example.com/webhooks/json2video?secret=s&job=j"}]}]


def test_captions_name_sender_and_lyrics():
    m = movie(photos=4, lines=["line one", "line two"])
    texts = [e["text"] for s in m["scenes"] for e in s["elements"] if e["type"] == "text"]
    assert texts[0] == "Happy Birthday, Priya!"
    assert texts[-1] == "With love, Rahul"
    assert "line one" in texts


def test_needs_photos():
    with pytest.raises(ValueError):
        movie(photos=0)


def test_song_prompt_times_the_lyrics():
    p = song_prompt(style="genz", mood="party", singer="duet", lyrics="Hey Priya\nyou rock\n\nso fun\nPriya!")
    assert "[0:00 - 0:15] Chorus:\nHey Priya\nyou rock\nso fun\nPriya!" in p
    assert "duet" in p
