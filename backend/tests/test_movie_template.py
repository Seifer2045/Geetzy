"""Movie template: validator (untrusted Grok output), renderer, xAI provider, and the "Generate with Grok" service."""
import copy
import json

import pytest

from app.providers import xai
from app.services import movie_design
from app.video import movie_template as mt

GOOD = movie_design.EXAMPLE


def ctx(**kw):
    base = dict(kind="preview", photo_urls=["https://p/1", "https://p/2", "https://p/3"], duration_sec=15,
                audio_url="https://a/song.mp3", values={"name": "Priya", "sender": "Rahul", "fun_fact": "loves chai", "occasion": "Birthday"})
    return mt.RenderContext(**{**base, **kw})


# ── validator
def test_the_example_given_to_grok_is_valid():
    assert mt.validate(GOOD, photos_min=1, photos_max=5) == []
    assert mt.validate(GOOD, photos_min=3, photos_max=3) == []


def _bad(mutate, **kw):
    m = copy.deepcopy(GOOD)
    mutate(m)
    return mt.validate(m, **{"photos_min": 1, "photos_max": 5, **kw})


@pytest.mark.parametrize("mutate,needle", [
    (lambda m: m["scenes"][0]["elements"].append({"type": "video", "src": "{{photo_1}}"}), "not allowed"),
    (lambda m: m["scenes"][0]["elements"][0].update(src="https://evil.example/x.png"), "no links"),
    (lambda m: m["scenes"][0]["elements"][0].update(src="{{photo_9}}"), "max photos"),
    (lambda m: m["scenes"][0]["elements"][0].update(src="{{secret}}"), "unknown marker"),
    (lambda m: m.update(exports=[{"destinations": []}]), "Unknown top-level"),
    (lambda m: m["scenes"][0].update(duration=99), "duration"),
    (lambda m: m["scenes"][1].update(transition="evil"), "transition"),
    (lambda m: m["scenes"][0]["elements"][1].update(text="x" * 500), "longer than"),
    (lambda m: m["scenes"][0]["elements"][1].update(text="{{photo_1}}"), "cannot be used in text"),
    (lambda m: m["scenes"][0]["elements"][1].update(box=[0, 0, 2, 2]), "inside the picture"),
    (lambda m: m["scenes"][0]["elements"][1].update(font="Comic Sans"), "font"),
    (lambda m: m["scenes"][0]["elements"][0].update(onclick="x"), "unknown field"),
    (lambda m: m["elements"][1].update(src="https://x/y.mp3"), "audio src"),
    (lambda m: m["scenes"][0]["elements"].append({"type": "audio", "src": "{{audio}}"}), "top-level"),
    (lambda m: m.update(scenes=[]), "at least one scene"),
])
def test_validator_rejects(mutate, needle):
    errs = _bad(mutate)
    assert errs and any(needle in e for e in errs), errs


def test_too_many_scenes_and_too_big():
    m = copy.deepcopy(GOOD)
    m["scenes"] = m["scenes"] * 6
    assert any("Too many scenes" in e for e in mt.validate(m))
    m = copy.deepcopy(GOOD)
    m["scenes"][0]["elements"][1]["text"] = "ok"
    m["pad"] = "x" * 30_000
    assert any("too big" in e for e in mt.validate(m))


def test_template_must_use_photo_1_and_survive_the_minimum():
    only_photo_2 = copy.deepcopy(GOOD)
    only_photo_2["scenes"] = [only_photo_2["scenes"][1]]
    assert any("photo_1" in e for e in mt.validate(only_photo_2))
    assert mt.validate("not json at all")  # not an object
    assert mt.validate(None)


# ── renderer
def test_markers_are_filled_and_geometry_is_in_pixels():
    body = mt.render_template(GOOD, ctx(kind="preview"))
    first = body["scenes"][0]["elements"][0]
    assert first["src"] == "https://p/1" and (first["x"], first["y"], first["width"], first["height"]) == (43, 96, 454, 480)
    hd = mt.render_template(GOOD, ctx(kind="hd"))
    assert (hd["width"], hd["height"], hd["quality"]) == (1080, 1920, "high")
    assert hd["scenes"][0]["elements"][0]["width"] == 907
    text = body["scenes"][0]["elements"][1]
    assert text["text"] == "Happy Birthday, Priya!" and text["settings"]["font-size"] == "7.5vw"
    assert body["scenes"][1]["elements"][1]["text"] == "loves chai"


def test_user_text_cannot_inject_markers_or_braces():
    body = mt.render_template(GOOD, ctx(values={"name": "{{audio}}{x}", "sender": "S", "fun_fact": "", "occasion": "B"}))
    assert body["scenes"][0]["elements"][1]["text"] == "Happy Birthday, audiox!"
    assert "{" not in json.dumps(body["scenes"][0]["elements"][1]["text"])


def test_empty_text_is_dropped():
    body = mt.render_template(GOOD, ctx(values={"name": "P", "sender": "S", "fun_fact": "", "occasion": "B"}))
    assert [e["type"] for e in body["scenes"][1]["elements"]] == ["image"]  # {{fun_fact}} was empty


def test_fewer_photos_drop_scenes_and_keep_the_total_length():
    for n in (1, 2, 3):
        body = mt.render_template(GOOD, ctx(photo_urls=[f"https://p/{i}" for i in range(n)]))
        assert len(body["scenes"]) == n
        overlap = mt.TRANSITION_SEC * (n - 1)
        assert abs(sum(s["duration"] for s in body["scenes"]) - overlap - 15) < 0.01


def test_audio_background_and_art_are_optional_markers():
    silent = mt.render_template(GOOD, ctx(audio_url=None))
    assert not any(e["type"] == "audio" for e in silent["elements"])
    with_audio = mt.render_template(GOOD, ctx(audio_seek=12.5))
    audio = next(e for e in with_audio["elements"] if e["type"] == "audio")
    assert audio["src"] == "https://a/song.mp3" and audio["seek"] == 12.5 and audio["duration"] == 15 and audio["fade-in"] == 0.3
    assert not any(e.get("src") == "x" for e in with_audio["elements"])
    with_bg = mt.render_template(GOOD, ctx(background_url="https://bg/x.jpg"))
    assert any(e.get("src") == "https://bg/x.jpg" for e in with_bg["elements"])  # no background url -> element removed


def test_watermark_only_on_preview_and_only_when_asked():
    texts = lambda b: [e["text"] for e in b["elements"] if e["type"] == "text"]  # noqa: E731
    assert texts(mt.render_template(GOOD, ctx(kind="preview"))) == ["GEETZY · PREVIEW"]
    assert texts(mt.render_template(GOOD, ctx(kind="preview", watermark=False))) == []
    assert texts(mt.render_template(GOOD, ctx(kind="hd"))) == []


def test_no_photos_is_an_error():
    with pytest.raises(mt.MovieTemplateError):
        mt.render_template(GOOD, ctx(photo_urls=[]))


# ── xAI provider
class _Resp:
    def __init__(self, status=200, body=None, text=""):
        self.status_code, self._body, self.text = status, body, text

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


def test_xai_returns_the_message_and_sends_json_mode(monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "xai_api_key", "k")
    seen = {}

    def post(url, headers, json, timeout):  # noqa: A002
        seen.update(url=url, headers=headers, body=json)
        return _Resp(body={"choices": [{"message": {"content": '{"scenes": []}'}}]})

    monkeypatch.setattr(xai.httpx, "post", post)
    assert xai.chat_json("sys", [{"role": "user", "content": "hi"}]) == '{"scenes": []}'
    assert seen["headers"]["Authorization"] == "Bearer k" and seen["body"]["response_format"] == {"type": "json_object"}
    assert seen["body"]["messages"][0] == {"role": "system", "content": "sys"} and seen["body"]["max_tokens"] == xai.MAX_TOKENS


def test_xai_errors_are_readable(monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "xai_api_key", "")
    with pytest.raises(xai.XaiError, match="XAI_API_KEY"):
        xai.chat_json("s", [])
    monkeypatch.setattr(get_settings(), "xai_api_key", "k")
    monkeypatch.setattr(xai.httpx, "post", lambda *a, **k: _Resp(status=401, text="bad key"))
    with pytest.raises(xai.XaiError, match="401"):
        xai.chat_json("s", [])
    monkeypatch.setattr(xai.httpx, "post", lambda *a, **k: _Resp(body={"nope": 1}))
    with pytest.raises(xai.XaiError, match="unexpected"):
        xai.chat_json("s", [])


# ── "Generate with Grok" service (in-memory fake database)
class _Q:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.fields, self.mode, self.count_mode = db, table, [], None, "select", False

    def select(self, *_a, count=None, head=False):
        self.count_mode = bool(count)
        return self

    def update(self, fields):
        self.mode, self.fields = "update", fields
        return self

    def insert(self, row):
        self.db.ai.append(row)
        return self

    def eq(self, col, val):
        self.filters.append((col, val))
        return self

    def gte(self, *_a):
        return self

    def execute(self):
        class R:
            data: list = []
            count = 0
        r = R()
        if self.table == "ai_requests":
            r.count = sum(1 for x in self.db.ai if x.get("kind") == "movie" and x.get("ok", True) is not None)
            r.data = self.db.ai
            return r
        row = self.db.row
        match = all(row.get(c) == v for c, v in self.filters)
        if self.mode == "update" and match:
            row.update(self.fields)
        r.data = [row] if match else []
        return r


class _Db:
    def __init__(self, **row):
        base = {"id": "TPL-1", "movie_status": "queued", "movie_prompt": "royal wedding style", "photos_min": 1, "photos_max": 3,
                "duration_sec": 15, "style": "bollywood", "layout_id": None, "song_mode": "both", "occasion": "birthday",
                "movie_json": None, "movie_hash": None, "categories": {"name": "Birthday"}}
        self.row, self.ai = {**base, **row}, []

    def table(self, name):
        return _Q(self, name)


@pytest.fixture
def grok(monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "xai_api_key", "k")
    d = _Db()
    monkeypatch.setattr(movie_design, "db", lambda: d)
    return d


def _replies(monkeypatch, *texts):
    calls = []
    queue = list(texts)
    monkeypatch.setattr(movie_design.xai, "chat_json", lambda system, messages: calls.append(messages) or queue.pop(0))
    return calls


def test_grok_good_reply_is_saved_and_old_preview_is_reset(grok, monkeypatch):
    calls = _replies(monkeypatch, json.dumps(GOOD))
    assert movie_design.generate("TPL-1") == "ready"
    assert grok.row["movie_json"] == GOOD and grok.row["movie_source"] == "grok" and grok.row["movie_status"] == "ready"
    assert grok.row["preview_status"] == "none" and grok.row["status"] == "draft" and grok.row["movie_hash"]
    assert len(calls) == 1 and len(grok.ai) == 1 and grok.ai[0]["kind"] == "movie" and grok.ai[0]["provider"] == "xai"
    assert "royal wedding style" in calls[0][0]["content"]


def test_grok_invalid_reply_gets_one_retry_with_the_errors(grok, monkeypatch):
    bad = copy.deepcopy(GOOD)
    bad["scenes"][0]["elements"][0]["src"] = "https://evil/x.png"
    calls = _replies(monkeypatch, json.dumps(bad), "```json\n" + json.dumps(GOOD) + "\n```")
    assert movie_design.generate("TPL-1") == "ready"
    assert len(calls) == 2 and "no links" in calls[1][-1]["content"] and grok.row["movie_json"] == GOOD
    assert len(grok.ai) == 2  # both calls are counted for the cost dashboard


def test_grok_twice_invalid_keeps_the_previous_json(grok, monkeypatch):
    grok.row["movie_json"] = {"scenes": ["previous"]}
    _replies(monkeypatch, "not json", '{"scenes": []}')
    assert movie_design.generate("TPL-1") == "error"
    assert grok.row["movie_json"] == {"scenes": ["previous"]}
    assert grok.row["movie_status"] == "error" and "rejected" in grok.row["movie_error"]


def test_same_brief_does_not_call_grok_again(grok, monkeypatch):
    calls = _replies(monkeypatch)  # any call would pop from an empty list and fail
    grok.row.update(movie_json=GOOD, movie_hash=movie_design.brief_hash(grok.row))
    assert movie_design.generate("TPL-1") == "unchanged" and not calls and grok.row["movie_status"] == "ready"


def test_daily_cap_blocks_the_call(grok, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "xai_calls_per_day", 1)
    grok.ai.append({"kind": "movie", "provider": "xai"})
    calls = _replies(monkeypatch)
    assert movie_design.generate("TPL-1") == "error" and not calls and "limit" in grok.row["movie_error"]


def test_only_a_queued_job_runs(grok, monkeypatch):
    grok.row["movie_status"] = "running"
    _replies(monkeypatch)
    assert movie_design.generate("TPL-1") == "skipped"
