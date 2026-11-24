"""Shared template song + spoken name: song spec, voice elements in the movie JSON, and the once-per-template song job."""
import copy
from types import SimpleNamespace

import pytest

from app import pipeline
from app.placeholders import strip
from app.providers import elevenlabs
from app.services import song_design
from tests.samples import EXAMPLE
from app.video import movie_template as mt
from app.video import song_spec

GOOD = EXAMPLE
SPEC = song_spec.default_spec(15)


def ctx(**kw):
    base = dict(kind="preview", photo_urls=["https://p/1", "https://p/2", "https://p/3"], duration_sec=15,
                audio_url="https://a/song.mp3", values={"name": "Priya", "sender": "Rahul", "fun_fact": "", "occasion": "Birthday"})
    return mt.RenderContext(**{**base, **kw})


def voices(body):
    return [e for e in body["elements"] if e["type"] == "voice"]


# ── song spec
def test_default_spec_is_valid_for_any_length():
    for d in (8, 15, 30):
        assert song_spec.validate(song_spec.default_spec(d), duration_sec=d) == []


@pytest.mark.parametrize("mutate,needle", [
    (lambda s: s.update(audio="https://evil/x.mp3"), "Unknown field"),
    (lambda s: s["name_slots"][0].update(text="{{fun_fact}}"), "cannot be spoken"),
    (lambda s: s["name_slots"][0].update(text="x" * 60), "longer than"),
    (lambda s: s["name_slots"][0].update(text=" "), "empty"),
    (lambda s: s["name_slots"][0].update(at=15), "'at'"),
    (lambda s: s["name_slots"].extend(copy.deepcopy(s["name_slots"]) * 3), "at most 3"),
    (lambda s: s["name_slots"][0].update(volume=2), "volume"),
    (lambda s: s["sections"][1].update(start=0.5), "overlaps"),
    (lambda s: s["sections"][0].update(end=99), "start < end"),
    (lambda s: s.update(duration_sec=20), "must match"),
])
def test_song_spec_rejects(mutate, needle):
    s = copy.deepcopy(SPEC)
    mutate(s)
    errs = song_spec.validate(s, duration_sec=15)
    assert errs and any(needle in e for e in errs), errs


def test_bad_spec_never_blocks_a_gift():
    assert song_spec.name_slots({"junk": 1}) == [] and song_spec.name_slots(None) == []
    assert song_spec.name_slots(SPEC) == [{"at": 3.3, "text": "{{name}}", "volume": 1.0}]


# ── movie JSON: voice element
def _with_voice(**kw):
    m = copy.deepcopy(GOOD)
    m["elements"].append({"type": "voice", "text": "{{name}}", "at": 3.2, **kw})
    return m


def test_voice_element_is_valid_and_rendered_with_the_gifts_name():
    m = _with_voice()
    assert mt.validate(m, photos_min=3, photos_max=5) == []
    v = voices(mt.render_template(m, ctx(voice="en-IN-X", voice_model="azure")))
    assert v == [{"type": "voice", "text": "Priya", "voice": "en-IN-X", "model": "azure", "start": 3.2, "volume": 1}]


def test_voice_name_is_cleaned_like_every_other_text():
    v = voices(mt.render_template(_with_voice(), ctx(values={"name": "Pri{ya}\n  K", "sender": "", "fun_fact": "", "occasion": ""})))
    assert v[0]["text"] == "Priya K"


@pytest.mark.parametrize("mutate,needle", [
    (lambda m: m["scenes"][0]["elements"].append({"type": "voice", "text": "{{name}}", "at": 1}), "top-level"),
    (lambda m: m["elements"][-1].update(text="{{fun_fact}}"), "cannot be spoken"),
    (lambda m: m["elements"][-1].update(text="x" * 90), "longer than"),
    (lambda m: m["elements"][-1].update(at=99), "'at'"),
    (lambda m: m["elements"][-1].update(src="https://evil"), "unknown field"),
    (lambda m: m["elements"].extend([copy.deepcopy(m["elements"][-1]) for _ in range(3)]), "At most 3"),
])
def test_validator_rejects_bad_voice(mutate, needle):
    m = _with_voice()
    mutate(m)
    errs = mt.validate(m, photos_min=1, photos_max=5)
    assert errs and any(needle in e for e in errs), errs


def test_silent_videos_get_no_voice():
    assert voices(mt.render_template(_with_voice(), ctx(audio_url=None))) == []
    assert voices(mt.render_template(GOOD, ctx(audio_url=None, song_slots=song_spec.name_slots(SPEC)))) == []


def test_slots_from_the_song_spec_are_used_when_the_template_has_no_voice():
    body = mt.render_template(GOOD, ctx(song_slots=song_spec.name_slots(SPEC)))
    assert [(v["text"], v["start"]) for v in voices(body)] == [("Priya", 3.3)]


def test_template_voice_elements_win_over_the_spec_so_the_name_is_not_said_twice():
    body = mt.render_template(_with_voice(), ctx(song_slots=song_spec.name_slots(SPEC)))
    assert len(voices(body)) == 1 and voices(body)[0]["start"] == 3.2


def test_text_can_appear_exactly_when_the_name_is_spoken():
    m = copy.deepcopy(GOOD)
    m["scenes"][0]["elements"][1].update(start=0.4, duration=1.5)
    assert mt.validate(m, photos_min=3, photos_max=5) == []
    text = mt.render_template(m, ctx())["scenes"][0]["elements"][1]
    assert text["start"] == 0.4 and text["duration"] == 1.5
    m["scenes"][0]["elements"][1].update(start=-1)
    assert any("start" in e for e in mt.validate(m, photos_min=3, photos_max=5))


def test_song_spec_is_frozen_on_the_gift():
    live = {"id": "t", "song_json": {"new": 1}, "updated_at": "later"}
    assert pipeline.with_frozen_design(live, {"design": {"song_json": SPEC, "updated_at": "then"}})["song_json"] is SPEC


# ── prompts
def test_placeholders_are_stripped_from_the_shared_song_prompt():
    assert strip("Birthday song for {name} from {sender}, about {fun_fact}") == "Birthday song for from , about"
    p = elevenlabs.build_prompt(direction="happy tune", style="genz", instrumental=True, structure="intro 0-3s")
    assert "no vocals" in p and "female" not in p and "Structure: intro 0-3s" in p
    assert "female vocals" in elevenlabs.build_prompt(direction="x", style="genz")  # old behaviour unchanged


# ── the once-per-template song job
class _Q:
    def __init__(self, db, table):
        self.db, self.table, self.op = db, table, "select"

    def select(self, *a, **k):
        self.op = "select"
        return self

    def update(self, values):
        self.op = "update"
        self.db.updates.append((self.table, values))
        return self

    def insert(self, values):
        self.op = "insert"
        self.db.inserts.append((self.table, values))
        return self

    def __getattr__(self, _name):  # eq, is_, gte, ... all just chain
        return lambda *a, **k: self

    def execute(self):
        return SimpleNamespace(data=self.db.rows(self.table, self.op), count=self.db.calls)


class _Db:
    def __init__(self, tpl, *, calls=0, claim=True):
        self.tpl, self.calls, self.claim, self.updates, self.inserts = tpl, calls, claim, [], []

    def table(self, name):
        return _Q(self, name)

    def rows(self, table, op):
        if table == "templates":
            return [self.tpl] if (op == "select" or self.claim) else []
        return []


TPL = {"id": "t1", "duration_sec": 15, "style": "genz", "song_prompt": "Happy birthday {name}, lively tune", "prompt": "",
       "song_json": None}


def _patch_song(monkeypatch, db, made):
    monkeypatch.setattr(song_design, "db", lambda: db)
    monkeypatch.setattr(song_design, "get_or_make_song", lambda prompt, **kw: made.append((prompt, kw)) or ("cache/x.mp3", False))
    monkeypatch.setattr(song_design, "signed_url", lambda b, p: "https://signed/x.mp3")
    monkeypatch.setattr(song_design.httpx, "get", lambda *a, **k: SimpleNamespace(content=b"mp3", raise_for_status=lambda: None))
    monkeypatch.setattr(song_design, "upload_bytes", lambda bucket, path, data, ct: path)


def test_song_job_makes_one_name_free_song_and_turns_the_template_into_a_fixed_song(monkeypatch):
    db, made = _Db(TPL), []
    _patch_song(monkeypatch, db, made)
    assert song_design.generate("t1") == "ready"
    prompt, kw = made[0]
    assert "Priya" not in prompt and "{name}" not in prompt and "no vocals" in prompt and kw["instrumental"] is True
    final = db.updates[-1][1]
    assert final["song_mode"] == "fixed" and final["song_status"] == "ready" and final["default_song_path"].startswith("templates/t1/song_")
    assert final["song_json"] == song_spec.default_spec(15) and final["status"] == "draft" and final["preview_status"] == "none"
    assert song_spec.validate(final["song_json"], duration_sec=15) == []


def test_song_job_keeps_an_admin_edited_valid_spec_and_replaces_an_invalid_one(monkeypatch):
    custom = song_spec.default_spec(15) | {"name_slots": [{"at": 6, "text": "{{name}} ji", "volume": 0.8}]}
    assert song_design.build_spec({**TPL, "song_json": custom}) == custom
    assert song_design.build_spec({**TPL, "song_json": {"junk": 1}}) == song_spec.default_spec(15)


def test_song_job_respects_the_daily_cap_and_reports_the_error(monkeypatch):
    db, made = _Db(TPL, calls=30), []
    _patch_song(monkeypatch, db, made)
    assert song_design.generate("t1") == "error"
    assert not made and db.updates[-1][1]["song_status"] == "error" and "daily" in db.updates[-1][1]["song_error"]
    assert "default_song_path" not in db.updates[-1][1]  # the previous song is untouched


def test_song_job_runs_once_when_two_runners_collide(monkeypatch):
    db, made = _Db(TPL, claim=False), []
    _patch_song(monkeypatch, db, made)
    assert song_design.generate("t1") == "skipped" and not made


def test_a_very_long_admin_prompt_is_trimmed_but_the_style_and_length_tail_survives():
    p = elevenlabs.build_prompt(direction="word " * 5000, style="genz", seconds=15, instrumental=True, structure="intro 0-3s")
    assert len(p) <= elevenlabs.PROMPT_MAX
    assert p.endswith("Structure: intro 0-3s.") and "Exactly 15 seconds" in p
