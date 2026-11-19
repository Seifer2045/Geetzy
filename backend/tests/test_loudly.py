import httpx
import pytest

from app.ai import loudly
from app.config import get_settings


def test_prompt_is_short_and_instrumental_style():
    p = loudly.music_prompt(style="bollywood", mood="party")
    assert len(p) <= loudly.PROMPT_MAX
    assert "dhol" in p and "dance" in p


@pytest.mark.parametrize("reply", [
    {"music_file_path": "https://cdn.x/song.mp3"},
    [{"music_file_path": "https://cdn.x/song.mp3"}],
    {"data": {"url": "https://cdn.x/song.mp3"}},
])
def test_audio_url_found_in_reply_shapes(reply):
    assert loudly._audio_url(reply) == "https://cdn.x/song.mp3"


def test_compose_song_downloads_mp3(monkeypatch):
    monkeypatch.setattr(get_settings(), "loudly_api_key", "k")
    sent = {}

    def fake_post(url, headers, data, timeout):
        sent.update(url=url, headers=headers, data=data)
        return httpx.Response(200, json={"id": "1", "music_file_path": "https://cdn.x/song.mp3"})

    monkeypatch.setattr(loudly.httpx, "post", fake_post)
    monkeypatch.setattr(loudly.httpx, "get", lambda url, **kw: httpx.Response(200, content=b"MP3"))
    assert loudly.compose_song("happy pop") == b"MP3"
    assert sent["url"].endswith("/api/ai/prompt/songs")
    assert sent["headers"]["API-KEY"] == "k"
    assert sent["data"]["duration"] == "30"


def test_missing_key_fails_clearly(monkeypatch):
    monkeypatch.setattr(get_settings(), "loudly_api_key", "")
    with pytest.raises(loudly.LoudlyError, match="LOUDLY_API_KEY"):
        loudly.compose_song("x")
