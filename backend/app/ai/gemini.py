"""Google Gemini API: lyrics (Gemini text model) and the sung song (Lyria 3 clip, 30 s MP3)."""
import base64
import json
import time
from dataclasses import dataclass

import httpx

from ..config import get_settings

BASE = "https://generativelanguage.googleapis.com/v1beta"
API_REVISION = "2026-05-20"  # Interactions API revision used by Lyria
LYRIA_TIMEOUT_SEC = 240
EST_COST_LYRICS_USD = 0.001
EST_COST_SONG_USD = 0.04

OCCASION_TEXT = {
    "birthday": "a birthday wish",
    "anniversary": "a romantic anniversary wish",
    "apology": "a cute, funny apology (saying sorry)",
    "festival": "an Indian festival greeting",
}
MOOD_TEXT = {
    "happy": "happy and cheerful",
    "filmy": "dramatic and filmy, like a Bollywood hit",
    "romantic": "soft and romantic",
    "party": "high-energy party",
}
VERSION_TEXT = {
    1: "Sweet and catchy.",
    2: "Funny and playful, with a light joke.",
    3: "Big and emotional, like a movie song.",
}
STYLE_MUSIC = {
    "bollywood": "Bollywood dhol-pop, dhol, tabla, synth brass, claps",
    "retro": "90s Indian retro synth-pop, analog synths, drum machine, warm tape feel",
    "genz": "modern Indian hyperpop / Gen Z pop, punchy 808s, bright synths",
}
MOOD_MUSIC = {
    "happy": "joyful, upbeat, 118 BPM",
    "filmy": "dramatic filmy, big chorus, 110 BPM",
    "romantic": "warm romantic ballad feel, 90 BPM",
    "party": "high-energy dance, 125 BPM",
}
SINGER_MUSIC = {
    "female": "clear female lead vocals",
    "male": "clear male lead vocals",
    "duet": "male and female duet vocals",
}


class GeminiError(RuntimeError):
    pass


@dataclass(frozen=True)
class LyricsResult:
    title: str
    lyrics: str


def _headers() -> dict[str, str]:
    return {"x-goog-api-key": get_settings().gemini_api_key, "Content-Type": "application/json"}


def _raise_for(res: httpx.Response, what: str) -> None:
    if res.status_code < 400:
        return
    try:
        message = res.json().get("error", {}).get("message", res.text)
    except ValueError:
        message = res.text
    raise GeminiError(f"{what} failed ({res.status_code}): {message[:300]}")


BUSY_CODES = {429, 500, 503}


def _generate_text(body: dict) -> httpx.Response:
    """Main model first; when Google is busy, wait a moment, then try the fallback model."""
    s = get_settings()
    models = [s.gemini_text_model, s.gemini_text_model, s.gemini_fallback_model]
    res: httpx.Response | None = None
    for attempt, model in enumerate(models):
        if attempt:
            time.sleep(1.5)
        res = httpx.post(f"{BASE}/models/{model}:generateContent", headers=_headers(), json=body, timeout=60)
        if res.status_code not in BUSY_CODES:
            break
    assert res is not None
    _raise_for(res, "Lyrics")
    return res


def write_lyrics(*, occasion: str, name: str, fun_fact: str, mood: str, version: int) -> LyricsResult:
    """4 short lines, the name in line 1 and 4, ready for a 15-second song."""
    fact = fun_fact.strip() or "no fun fact given"
    prompt = (
        f"Write lyrics for a 15-second Indian English song: {OCCASION_TEXT.get(occasion, 'a gift')} for {name}.\n"
        f"Fun fact about {name}: {fact}.\n"
        f"Mood: {MOOD_TEXT.get(mood, mood)}. {VERSION_TEXT.get(version, '')}\n"
        "Rules: exactly 4 short rhyming lines (max 9 words each). Use the name in line 1 and line 4. "
        "Use the fun fact naturally. A few Hindi words are fine (e.g. yaar, dil), written in English letters. "
        "Family-friendly. No artist names, no existing song lyrics.\n"
        "Also give a short song title (max 4 words) that includes the name."
    )
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 1.0,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {"title": {"type": "STRING"}, "lines": {"type": "ARRAY", "items": {"type": "STRING"}}},
                "required": ["title", "lines"],
            },
        },
    }
    res = _generate_text(body)
    try:
        text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)
        lines = [line.strip() for line in data["lines"] if line.strip()][:4]
        if len(lines) < 2:
            raise ValueError("too few lines")
        return LyricsResult(title=data["title"].strip()[:40], lyrics="\n".join(lines))
    except (KeyError, IndexError, ValueError) as e:
        raise GeminiError(f"Lyrics: unexpected reply ({e})") from e


def song_prompt(*, style: str, mood: str, singer: str, lyrics: str) -> str:
    """Lyria prompt: music description + timed lyrics so the name is sung in the first 15 s."""
    lines = [line for line in lyrics.splitlines() if line.strip()]
    return (
        f"{STYLE_MUSIC.get(style, 'Indian pop')}, {MOOD_MUSIC.get(mood, 'upbeat')}, {SINGER_MUSIC.get(singer, 'lead vocals')}. "
        "Indian English pronunciation. Start singing immediately, no long intro.\n\n"
        "Lyrics:\n"
        "[0:00 - 0:15] Chorus:\n" + "\n".join(lines) + "\n"
        "[0:15 - 0:30] Chorus:\n" + "\n".join(lines) + "\n"
    )


def _audio_from(data: dict) -> bytes | None:
    for step in data.get("steps", []) or []:
        for block in step.get("content", []) or []:
            if block.get("type") == "audio" and block.get("data"):
                return base64.b64decode(block["data"])
    audio = data.get("output_audio") or data.get("outputAudio")
    if isinstance(audio, dict) and audio.get("data"):
        return base64.b64decode(audio["data"])
    return None


def compose_song(prompt: str) -> bytes:
    """Returns MP3 bytes (30 s clip). Waits if the API answers with a still-running interaction."""
    s = get_settings()
    headers = {**_headers(), "Api-Revision": API_REVISION}
    deadline = time.monotonic() + LYRIA_TIMEOUT_SEC
    res = httpx.post(f"{BASE}/interactions", headers=headers, json={"model": s.lyria_model, "input": prompt}, timeout=LYRIA_TIMEOUT_SEC)
    _raise_for(res, "Song")
    data = res.json()
    while (audio := _audio_from(data)) is None:
        status = str(data.get("status", "")).lower()
        if status in ("failed", "cancelled", "canceled") or not data.get("id") or time.monotonic() > deadline:
            raise GeminiError(f"Song: no audio returned (status={status or 'unknown'})")
        time.sleep(3)
        res = httpx.get(f"{BASE}/interactions/{data['id']}", headers=headers, timeout=60)
        _raise_for(res, "Song status")
        data = res.json()
    return audio
