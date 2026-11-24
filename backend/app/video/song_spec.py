"""Song spec: the shared song of a template, described as small strict JSON.

One ElevenLabs song is made per template (not per gift). This JSON says how it is built and WHERE the gift's name is
spoken over it by JSON2Video, so the template's captions and the renderer (voice) work from the same timings.

    {"version": 1, "duration_sec": 15, "instrumental": true,
     "sections":   [{"name": "intro", "start": 0, "end": 3}, ...],
     "name_slots": [{"at": 3.2, "text": "{{name}}", "volume": 1}]}

Like the movie template, it is UNTRUSTED when an admin edits it: no links, no unknown fields, text markers only.
The audio file itself is NOT in the JSON (it lives in templates.default_song_path), so JSON can never point elsewhere.
"""
import json
import re
from typing import Any

MAX_BYTES = 4_000
MAX_SECTIONS = 8
MAX_SLOTS = 3
MAX_SLOT_TEXT = 40
SLOT_MARKERS = ("name", "sender")
MARKER = re.compile(r"\{\{\s*([A-Za-z_0-9]+)\s*\}\}")

TOP_KEYS = {"version", "duration_sec", "instrumental", "sections", "name_slots"}
SECTION_KEYS = {"name", "start", "end"}
SLOT_KEYS = {"at", "text", "volume"}


def _is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def default_spec(duration_sec: int = 15, *, instrumental: bool = True) -> dict:
    """intro / hook / outro, and the name spoken once, early in the hook."""
    d = float(duration_sec)
    intro, hook = round(d * 0.2, 1), round(d * 0.7, 1)
    return {
        "version": 1, "duration_sec": int(duration_sec), "instrumental": instrumental,
        "sections": [
            {"name": "intro", "start": 0, "end": intro},
            {"name": "hook", "start": intro, "end": hook},
            {"name": "outro", "start": hook, "end": d},
        ],
        "name_slots": [{"at": round(d * 0.22, 1), "text": "{{name}}", "volume": 1}],
    }


def validate(spec: Any, *, duration_sec: int | None = None) -> list[str]:
    """Plain-English problems with a song spec. Empty list = safe to use."""
    if not isinstance(spec, dict):
        return ["The song spec must be a JSON object."]
    if len(json.dumps(spec, ensure_ascii=False)) > MAX_BYTES:
        return [f"The song spec is too big (max {MAX_BYTES // 1000} KB)."]
    errs: list[str] = []
    extra = set(spec) - TOP_KEYS
    if extra:
        errs.append(f"Unknown field(s): {', '.join(sorted(extra))}.")
    dur = spec.get("duration_sec")
    if not (_is_num(dur) and 3 <= dur <= 60):
        return errs + ["duration_sec must be a number from 3 to 60."]
    if duration_sec is not None and abs(dur - duration_sec) > 0.01:
        errs.append(f"duration_sec ({dur}) must match the template length ({duration_sec}).")
    if "instrumental" in spec and not isinstance(spec["instrumental"], bool):
        errs.append("instrumental must be true or false.")

    sections = spec.get("sections", [])
    if not isinstance(sections, list) or len(sections) > MAX_SECTIONS:
        errs.append(f"sections must be a list of at most {MAX_SECTIONS}.")
    else:
        last_end = 0.0
        for i, s in enumerate(sections, 1):
            where = f"Section {i}"
            if not isinstance(s, dict):
                errs.append(f"{where}: must be an object.")
                continue
            if set(s) - SECTION_KEYS:
                errs.append(f"{where}: unknown field(s) {', '.join(sorted(set(s) - SECTION_KEYS))}.")
            if not (isinstance(s.get("name"), str) and 0 < len(s["name"]) <= 30):
                errs.append(f"{where}: name must be 1-30 characters.")
            start, end = s.get("start"), s.get("end")
            if not (_is_num(start) and _is_num(end) and 0 <= start < end <= dur):
                errs.append(f"{where}: needs 0 <= start < end <= {dur}.")
            elif start < last_end - 0.01:
                errs.append(f"{where}: overlaps the section before it.")
            else:
                last_end = end

    slots = spec.get("name_slots", [])
    if not isinstance(slots, list) or len(slots) > MAX_SLOTS:
        errs.append(f"name_slots must be a list of at most {MAX_SLOTS}.")
    else:
        for i, sl in enumerate(slots, 1):
            where = f"Name slot {i}"
            if not isinstance(sl, dict):
                errs.append(f"{where}: must be an object.")
                continue
            if set(sl) - SLOT_KEYS:
                errs.append(f"{where}: unknown field(s) {', '.join(sorted(set(sl) - SLOT_KEYS))}.")
            if not (_is_num(sl.get("at")) and 0 <= sl["at"] <= dur - 1):
                errs.append(f"{where}: 'at' must be between 0 and {dur - 1} seconds.")
            errs += _check_slot_text(sl.get("text"), where)
            if "volume" in sl and not (_is_num(sl["volume"]) and 0 <= sl["volume"] <= 1):
                errs.append(f"{where}: volume must be between 0 and 1.")
    return errs


def _check_slot_text(text: Any, where: str) -> list[str]:
    if not isinstance(text, str) or not text.strip():
        return [f"{where}: text is empty."]
    errs = []
    if len(text) > MAX_SLOT_TEXT:
        errs.append(f"{where}: text is longer than {MAX_SLOT_TEXT} characters.")
    for m in MARKER.findall(text):
        if m.strip() not in SLOT_MARKERS:
            errs.append(f"{where}: {{{{{m.strip()}}}}} cannot be spoken (allowed: {', '.join('{{' + k + '}}' for k in SLOT_MARKERS)}).")
    return errs


def name_slots(spec: Any) -> list[dict]:
    """The spoken slots of a spec, or [] if it is missing / invalid (a bad spec must never block a gift)."""
    if not isinstance(spec, dict) or validate(spec):
        return []
    return [{"at": float(s["at"]), "text": s["text"], "volume": float(s.get("volume", 1))} for s in spec.get("name_slots", [])]
