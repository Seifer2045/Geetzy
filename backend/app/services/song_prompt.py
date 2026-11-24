"""The ElevenLabs prompt for ONE person's song, built from everything the user chose on the song screen.

The prompt is assembled in code from ids and cleaned text, never pasted raw, so the user can personalise a lot
without being able to steer the model away from "a warm 15 second song". Order matters (most important first):
  1. the admin's own brief for this template (already filled with {name} etc.)
  2. who it is for: occasion, names, relationship, nature, fun fact
  3. the sound: language, music style, mood, singer, template style
  4. fixed rules: say the name in the hook, family friendly, exact length, structure
  5. the user's own idea (last = lowest priority)
The tail (3 + 4) is never cut when the prompt is too long; the admin brief and the user's idea are.
"""
import re

from ..providers.elevenlabs import MOOD_HINT, PROMPT_MAX, SINGER_HINT, STYLE_HINT
from ..placeholders import fill

LANGUAGE_HINT = {
    "hindi": "Sung in Hindi", "hinglish": "Sung in Hinglish (Hindi mixed with a little English)", "english": "Sung in English",
    "punjabi": "Sung in Punjabi", "tamil": "Sung in Tamil", "telugu": "Sung in Telugu",
}
MUSIC_STYLE_HINT = {
    "bollywood_pop": "Bollywood pop with dhol and strings", "punjabi_bhangra": "Punjabi bhangra with dhol and tumbi, high energy",
    "acoustic": "soft acoustic guitar", "lofi": "chilled lo-fi beats", "edm_party": "Indian EDM party drop, big bass",
    "sufi": "Sufi and qawwali feel with harmonium and claps", "ballad": "slow emotional ballad with piano",
}
RELATIONSHIP_HINT = {
    "friend": "a close friend", "partner": "their partner", "mom": "their mother", "dad": "their father",
    "sibling": "their brother or sister", "colleague": "a colleague", "relative": "a relative",
}
TRAIT_HINT = {
    "funny": "funny", "caring": "caring", "foodie": "loves food", "always_late": "always running late", "dancer": "loves to dance",
    "traveller": "loves travelling", "gamer": "a gamer", "bookworm": "loves books", "sporty": "sporty", "shy": "shy and sweet",
}

MAX_IDEA = 150
MAX_FACT = 120
# "in the style of <someone>" and friends make ElevenLabs refuse the prompt (it blocks real artists and songs).
_STYLE_OF = re.compile(r"\b(in the style of|in style of|sounds? like|similar to|like the song|cover of|remix of|copy of)\b[^,.;\n]*", re.I)
_URL = re.compile(r"https?://\S+|www\.\S+", re.I)


def clean_text(value: str | None, limit: int) -> str:
    """One line, no braces/markup/links, no "in the style of <artist>", capped."""
    text = _URL.sub("", value or "")
    text = _STYLE_OF.sub("", text)
    text = re.sub(r"[{}<>\[\]\\|`]", "", text)
    return " ".join(text.split())[:limit].strip()


def build_user_prompt(
    *, direction: str, style: str, occasion: str, name: str, sender: str, fun_fact: str, mood: str, singer: str,
    prefs: dict | None, seconds: int = 15, instrumental: bool = False,
) -> str:
    prefs = prefs or {}
    who = clean_text(name, 40) or "them"
    from_ = clean_text(sender, 40)
    parts: list[str] = []

    about = f"A {seconds} second {clean_text(occasion, 30) or 'birthday'} song for {who}" + (f", from {from_}." if from_ else ".")
    if prefs.get("relationship") in RELATIONSHIP_HINT:
        about += f" {who} is {RELATIONSHIP_HINT[prefs['relationship']]} of the person who sends it."
    traits = [TRAIT_HINT[t] for t in (prefs.get("traits") or [])[:3] if t in TRAIT_HINT]
    if traits:
        about += f" {who} is " + ", ".join(traits) + "."
    fact = clean_text(fun_fact, MAX_FACT)
    if fact:
        about += f" Work in this fun fact lightly: {fact}."
    parts.append(about)

    sound: list[str] = []
    if instrumental:
        sound.append("instrumental only, no vocals")
    else:
        sound.append(LANGUAGE_HINT.get(prefs.get("language") or "hinglish", LANGUAGE_HINT["hinglish"]))
        sound.append(SINGER_HINT.get(singer, "vocals"))
    sound.append(MUSIC_STYLE_HINT.get(prefs.get("music_style") or "", STYLE_HINT.get(style, "Indian pop")))
    sound.append(MOOD_HINT.get(mood, "upbeat"))
    parts.append("Sound: " + ", ".join(sound) + ".")

    rules = [f"Exactly {seconds} seconds, strong start, clean ending.", "Warm, positive and family friendly, no explicit words."]
    if not instrumental:
        rules.insert(0, f"Sing the name {who} clearly in the hook.")
        rules.append("Structure: short intro, hook with the name, clean ending.")
    tail = " ".join(rules)

    idea = clean_text(prefs.get("idea"), MAX_IDEA)
    idea_line = f"Extra wish from the user (lowest priority): {idea}." if idea else ""

    middle = "\n".join(parts + ([idea_line] if idea_line else []))
    head = " ".join((direction or "").split())
    budget = PROMPT_MAX - len(middle) - len(tail) - 3
    head = head[: max(0, budget)]
    return "\n".join(x for x in (head, middle, tail) if x)[:PROMPT_MAX]


def gift_prompt(tpl: dict, g: dict, song: dict) -> str:
    """The prompt for a gift whose song has to be made by the pipeline (no draft was made on the phone)."""
    direction = fill(tpl.get("song_prompt") or tpl.get("prompt") or "", name=g["recipient_name"], sender=g["sender_name"],
                     fun_fact=g["fun_fact"], occasion=g["occasion"])
    return build_user_prompt(
        direction=direction, style=tpl["style"], occasion=g["occasion"], name=g["recipient_name"], sender=g["sender_name"],
        fun_fact=g["fun_fact"], mood=song.get("mood") or "happy", singer=song.get("singer") or "female",
        prefs=song.get("prefs"), seconds=tpl["duration_sec"], instrumental=bool(tpl.get("song_instrumental")),
    )
