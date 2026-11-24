"""ElevenLabs Music: one text prompt in, one short MP3 out (sung, unless instrumental).

POST https://api.elevenlabs.io/v1/music?output_format=mp3_44100_64
header xi-api-key, JSON {prompt, music_length_ms (3000-600000), model_id, force_instrumental}. Reply = MP3 bytes.
Endpoint and field names are written from memory — verify on the first real call (same caveat as the old Loudly code).

Cost rules (every call costs credits):
- length is exactly the video length (15 s), never longer;
- 64 kbps MP3 is plenty for a phone video and keeps files small;
- the caller caches by prompt hash (see `song_hash`) so retries never pay twice.
"""
import hashlib

import httpx

from ..config import get_settings

API = "https://api.elevenlabs.io/v1/music"
OUTPUT_FORMAT = "mp3_44100_64"
TIMEOUT_SEC = 120
MIN_MS, MAX_MS = 3_000, 600_000
PROMPT_MAX = 4_000  # ElevenLabs' own limit is the real ceiling (verify); longer admin prompts are trimmed, see build_prompt
EST_COST_SONG_USD = 0.03  # rough estimate for ~15 s, shown on the admin dashboard only

STYLE_HINT = {
    "bollywood": "Bollywood pop, dhol, tabla, brass, filmy hook",
    "retro": "90s Indian retro synth pop, drum machine, nostalgic",
    "genz": "modern Indian pop, punchy 808s, bright synths, catchy",
}
MOOD_HINT = {
    "happy": "joyful upbeat",
    "filmy": "dramatic filmy, big chorus",
    "romantic": "warm romantic",
    "party": "high-energy dance",
}
SINGER_HINT = {"female": "female vocals", "male": "male vocals", "duet": "male and female duet vocals"}


class ElevenLabsError(RuntimeError):
    pass


def build_prompt(
    *, direction: str, style: str, mood: str = "happy", singer: str = "female", seconds: int = 15,
    instrumental: bool = False, structure: str = "",
) -> str:
    """The admin's audio prompt (already filled with the user's name etc.) + a short style tail.

    `instrumental` = the shared template song: no vocals, and room for a spoken name (added later by JSON2Video).
    `structure` = e.g. "intro 0-3s, hook 3-10s, outro 10-15s" from the song spec.
    """
    voice = "instrumental only, no vocals, a clear gap for a spoken name" if instrumental else SINGER_HINT.get(singer, "vocals")
    tail = f"{STYLE_HINT.get(style, 'Indian pop')}, {MOOD_HINT.get(mood, 'upbeat')}, {voice}. " \
           f"Exactly {seconds} seconds, strong start, clean ending." + (f" Structure: {structure}." if structure else "")
    # A very long admin prompt is trimmed, never the tail: the tail carries the length and style the song must follow.
    text = " ".join((direction or "").split())[: max(0, PROMPT_MAX - len(tail) - 1)]
    return f"{text}\n{tail}" if text else tail[:PROMPT_MAX]


def song_hash(prompt: str, length_ms: int, instrumental: bool) -> str:
    """Cache key: the same prompt, length and vocal setting always gives the same stored MP3."""
    raw = f"{get_settings().elevenlabs_model}|{length_ms}|{int(instrumental)}|{prompt}"
    return hashlib.sha256(raw.encode()).hexdigest()


def compose_song(prompt: str, *, seconds: int = 15, instrumental: bool = False) -> bytes:
    """Returns MP3 bytes."""
    s = get_settings()
    if not s.elevenlabs_api_key:
        raise ElevenLabsError("ELEVENLABS_API_KEY is not set")
    length_ms = max(MIN_MS, min(MAX_MS, int(seconds * 1000)))
    res = httpx.post(
        API,
        params={"output_format": OUTPUT_FORMAT},
        headers={"xi-api-key": s.elevenlabs_api_key, "Content-Type": "application/json"},
        json={"prompt": prompt[:PROMPT_MAX], "music_length_ms": length_ms, "model_id": s.elevenlabs_model,
              "force_instrumental": instrumental},
        timeout=TIMEOUT_SEC,
    )
    if res.status_code >= 400:
        raise ElevenLabsError(f"Song failed ({res.status_code}): {res.text[:300]}")
    if not res.content:
        raise ElevenLabsError("Song: empty reply")
    return res.content
