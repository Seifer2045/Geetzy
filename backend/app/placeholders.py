"""Placeholders the admin can write inside prompts: {name} {sender} {fun_fact} {occasion}.

Replaced per user with a regex on the four known keys only (not str.format), so a stray "{" or an unknown
{key} in an admin prompt can never crash a generation. Values are cleaned and capped, because they come from
users and end up inside AI prompts.
"""
import re

KEYS = ("name", "sender", "fun_fact", "occasion")
_PATTERN = re.compile(r"\{(" + "|".join(KEYS) + r")\}")
MAX_VALUE = {"name": 40, "sender": 40, "fun_fact": 200, "occasion": 40}


def _clean(value: str | None, limit: int) -> str:
    """One line, no braces (so a value can't introduce a placeholder), capped."""
    return " ".join((value or "").replace("{", "").replace("}", "").split())[:limit]


def fill(text: str | None, *, name: str = "", sender: str = "", fun_fact: str = "", occasion: str = "") -> str:
    """Replaces every known placeholder. Unknown {keys} are left untouched."""
    values = {"name": name, "sender": sender, "fun_fact": fun_fact, "occasion": occasion}
    return _PATTERN.sub(lambda m: _clean(values[m.group(1)], MAX_VALUE[m.group(1)]), text or "")


def strip(text: str | None) -> str:
    """Removes every known placeholder (for the SHARED template song, which must not contain any user's name)."""
    return " ".join(_PATTERN.sub("", text or "").split())


def used_keys(text: str | None) -> set[str]:
    return set(_PATTERN.findall(text or ""))
