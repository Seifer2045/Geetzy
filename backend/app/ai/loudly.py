"""Loudly text-to-music (TEMPORARY song provider, swap back to Lyria via SONG_PROVIDER=lyria).

Loudly makes INSTRUMENTAL music only — our lyrics are not sung, they are shown as text in the video.
API: POST {BASE}/api/ai/prompt/songs, header API-KEY, form fields prompt (max ~150 chars) + duration (s).
Reply: JSON with the MP3 link in `music_file_path`.
"""
import httpx

from ..config import get_settings

BASE = "https://soundtracks.loudly.com"
TIMEOUT_SEC = 180
SONG_SECONDS = 30  # same length as Lyria; the video uses the first 15 s
PROMPT_MAX = 150
EST_COST_SONG_USD = 0.0  # unknown on our plan; update when we know the price
AUDIO_KEYS = ("music_file_path", "musicFilePath", "file_path", "audio_url", "url")

STYLE_MUSIC = {
    "bollywood": "Bollywood dhol pop, tabla, brass, claps",
    "retro": "90s Indian retro synth pop, drum machine",
    "genz": "modern Indian hyperpop, punchy 808s, bright synths",
}
MOOD_MUSIC = {
    "happy": "joyful upbeat",
    "filmy": "dramatic filmy, big chorus",
    "romantic": "warm romantic ballad",
    "party": "high-energy dance",
}


class LoudlyError(RuntimeError):
    pass


def music_prompt(*, style: str, mood: str) -> str:
    """Short instrumental prompt (Loudly limit ~150 chars)."""
    text = f"{MOOD_MUSIC.get(mood, 'upbeat')} {STYLE_MUSIC.get(style, 'Indian pop')}, catchy hook, starts strong, no long intro"
    return text[:PROMPT_MAX]


def _audio_url(data: object) -> str | None:
    if isinstance(data, list):
        data = data[0] if data else {}
    if not isinstance(data, dict):
        return None
    for key in AUDIO_KEYS:
        if isinstance(data.get(key), str) and data[key].startswith("http"):
            return data[key]
    nested = data.get("data") or data.get("song")
    return _audio_url(nested) if nested else None


def compose_song(prompt: str) -> bytes:
    """Returns MP3 bytes (about 30 s, instrumental)."""
    key = get_settings().loudly_api_key
    if not key:
        raise LoudlyError("LOUDLY_API_KEY is not set")
    res = httpx.post(
        f"{BASE}/api/ai/prompt/songs",
        headers={"API-KEY": key, "Accept": "application/json"},
        data={"prompt": prompt[:PROMPT_MAX], "duration": str(SONG_SECONDS)},
        timeout=TIMEOUT_SEC,
    )
    if res.status_code >= 400:
        raise LoudlyError(f"Song failed ({res.status_code}): {res.text[:300]}")
    try:
        url = _audio_url(res.json())
    except ValueError as e:
        raise LoudlyError(f"Song: reply is not JSON: {res.text[:200]}") from e
    if not url:
        raise LoudlyError(f"Song: no audio link in reply: {res.text[:300]}")
    audio = httpx.get(url, timeout=120, follow_redirects=True)
    if audio.status_code >= 400 or not audio.content:
        raise LoudlyError(f"Song download failed ({audio.status_code})")
    return audio.content
