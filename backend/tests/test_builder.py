"""Template builder rules: price snapping, song cache (no double ElevenLabs bill), video prompt, own song window."""
import pytest

from app.providers import elevenlabs
from app.services import songs
from app.services.pricing import effective_price, nearest_tier
from app.video.json2video import MovieInput, build_movie, split_video_prompt

TIERS = [{"id": "tier_29", "price_inr": 29}, {"id": "tier_49", "price_inr": 49}, {"id": "tier_99", "price_inr": 99}]


def test_custom_price_wins_over_tier_price():
    assert effective_price({"custom_price_inr": 59, "price_tiers": {"price_inr": 49}}) == 59
    assert effective_price({"custom_price_inr": None, "price_tiers": {"price_inr": 49}}) == 49


def test_nearest_tier_snaps_and_ties_go_cheaper():
    assert nearest_tier(59, TIERS)["id"] == "tier_49"
    assert nearest_tier(80, TIERS)["id"] == "tier_99"
    assert nearest_tier(39, TIERS)["id"] == "tier_29"  # 39 is 10 from 29 and 10 from 49 -> cheaper


def test_video_prompt_lines_become_headline_and_closing():
    assert split_video_prompt("Happy Bday Priya!\n\nLove, Rahul") == ("Happy Bday Priya!", "Love, Rahul")
    assert split_video_prompt("") == ("", "")
    assert split_video_prompt("Only one line") == ("Only one line", "")


def _movie(**kw):
    base = dict(kind="hd", occasion="birthday", style="genz", recipient_name="Priya", sender_name="Rahul",
                photo_urls=["a", "b", "c"], audio_url="x.mp3")
    return build_movie(MovieInput(**{**base, **kw}), webhook_url="https://w", client_data={})


def _texts(m):
    return [e["text"] for s in m["scenes"] for e in s["elements"] if e["type"] == "text"]


def test_admin_headline_and_closing_replace_defaults():
    t = _texts(_movie(headline="Yay Priya!", closing="Yours, Rahul"))
    assert t[0] == "Yay Priya!" and t[-1] == "Yours, Rahul"
    t = _texts(_movie())
    assert t[0] == "Happy Birthday, Priya!" and t[-1] == "With love, Rahul"


@pytest.mark.parametrize("n", [1, 3, 5, 10])
def test_photo_count_drives_scene_count_and_total_length(n):
    m = _movie(photo_urls=[str(i) for i in range(n)], duration_sec=15)
    assert len(m["scenes"]) == n
    total = sum(s["duration"] for s in m["scenes"]) - (n - 1) * 0.6
    assert abs(total - 15) < 0.01


class _Table:
    def __init__(self, store):
        self.store, self.row = store, None

    def select(self, *_):
        return self

    def eq(self, _col, val):
        self.row = self.store.get(val)
        return self

    def upsert(self, row):
        self.store[row["hash"]] = row
        return self

    def execute(self):
        class R:  # noqa: D401
            pass
        r = R()
        r.data = [self.row] if self.row else []
        self.row = None
        return r


class _FakeDb:
    def __init__(self):
        self.store = {}

    def table(self, _name):
        return _Table(self.store)


def test_same_prompt_is_paid_once(monkeypatch):
    fake = _FakeDb()
    calls = []
    monkeypatch.setattr(songs, "db", lambda: fake)
    monkeypatch.setattr(songs, "upload_bytes", lambda bucket, path, data, ct: path)
    monkeypatch.setattr(elevenlabs, "compose_song", lambda prompt, **kw: calls.append(prompt) or b"mp3")

    first, cached1 = songs.get_or_make_song("sing for Priya", seconds=15, instrumental=False)
    second, cached2 = songs.get_or_make_song("sing for Priya", seconds=15, instrumental=False)
    assert (cached1, cached2) == (False, True) and first == second and len(calls) == 1

    songs.get_or_make_song("sing for Priya", seconds=15, instrumental=True)  # different vocal setting = new song
    assert len(calls) == 2


def test_failed_song_is_reported_not_cached(monkeypatch):
    fake = _FakeDb()
    seen = []
    monkeypatch.setattr(songs, "db", lambda: fake)

    def boom(prompt, **kw):
        raise elevenlabs.ElevenLabsError("no credits")

    monkeypatch.setattr(elevenlabs, "compose_song", boom)
    with pytest.raises(elevenlabs.ElevenLabsError):
        songs.get_or_make_song("p", seconds=15, instrumental=False, on_made=lambda ms, ok, err: seen.append((ok, err)))
    assert seen == [(False, "no credits")] and not fake.store


def test_elevenlabs_requires_a_key(monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "elevenlabs_api_key", "")
    with pytest.raises(elevenlabs.ElevenLabsError):
        elevenlabs.compose_song("p")


def test_gradient_background_is_9x16_and_uses_both_colours():
    import io

    from PIL import Image

    from app.studio import art
    img = Image.open(io.BytesIO(art.gradient_background("#FF0000", "#0000FF")))
    assert img.size == (1080, 1920)
    top, bottom = img.getpixel((10, 2)), img.getpixel((10, 1917))
    assert top[0] > 200 and top[2] < 60 and bottom[2] > 200 and bottom[0] < 60
