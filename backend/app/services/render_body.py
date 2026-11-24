"""One place that decides HOW a video is described to JSON2Video:
the template's own movie JSON when it has one (native JSON2Video JSON from the Editor / a starter, or the older compact format),
else the built-in design.
Used by real gifts (pipeline.py) and by the admin's template preview (studio/service.py)."""
import logging

from ..config import get_settings
from ..studio.layouts import Slot
from ..video import movie_template as mt
from ..video import native_template as native
from ..video import song_spec
from ..video.json2video import MovieInput, build_movie, builtin_frames

log = logging.getLogger("geetzy.render")


def photo_frames(tpl: dict, *, n_photos: int, studio_art: bool, slot: Slot | None) -> dict[int, set[tuple[int, int]]]:
    """Every frame (HD pixels) in which a user photo is shown, per photo number. Mirrors the choice `movie_body` makes."""
    movie_json = tpl.get("movie_json")
    if movie_json:
        try:
            if native.is_native(movie_json):
                return native.photo_frames(movie_json, n_photos=n_photos)
            return mt.photo_frames(movie_json, n_photos=n_photos)
        except Exception:  # noqa: BLE001 — same fallback as movie_body
            log.exception("could not read the photo frames of %s", tpl.get("id"))
    return builtin_frames(n_photos, orientation=tpl.get("orientation") or "vertical", art_url="x" if studio_art else None, slot=slot)


def movie_body(
    tpl: dict, *, kind: str, occasion: str, recipient: str, sender: str, fun_fact: str, photo_urls: list[str],
    audio_url: str | None, audio_seek: float, fade: bool, lyric_lines: list[str], art_url: str | None,
    background_url: str | None, slot: Slot | None, watermark: bool, webhook_url: str, client_data: dict[str, str],
    headline: str = "", closing: str = "", song_json: dict | None = None,
    photo_variants: dict[str, str] | None = None,
) -> dict:
    movie_json = tpl.get("movie_json")
    if movie_json:
        try:
            s = get_settings()
            ctx = mt.RenderContext(
                kind=kind,  # type: ignore[arg-type]
                photo_urls=photo_urls, duration_sec=tpl["duration_sec"], audio_url=audio_url, audio_seek=audio_seek, fade=fade,
                art_url=art_url, background_url=background_url, color_to=tpl["color_to"], watermark=watermark,
                values={"name": recipient, "sender": sender, "fun_fact": fun_fact, "occasion": occasion},
                song_slots=song_spec.name_slots(song_json), voice=s.name_voice, voice_model=s.name_voice_model,
                photo_variants=photo_variants or {},
            )
            body = native.render(movie_json, ctx) if native.is_native(movie_json) else mt.render_template(movie_json, ctx)
            body["client-data"] = client_data
            body["exports"] = [{"destinations": [{"type": "webhook", "endpoint": webhook_url}]}]
            return body
        except Exception:  # noqa: BLE001 — a bad template must never block a gift: use the built-in design
            log.exception("movie template of %s could not be rendered, using the built-in design", tpl.get("id"))

    return build_movie(
        MovieInput(
            kind=kind,  # type: ignore[arg-type]
            occasion=occasion, style=tpl["style"], recipient_name=recipient, sender_name=sender, photo_urls=photo_urls,
            audio_url=audio_url, audio_seek=audio_seek, fade=fade, lyric_lines=lyric_lines,
            color_from=tpl["color_from"], color_to=tpl["color_to"], render_config=tpl["render_config"] or {},
            duration_sec=tpl["duration_sec"], orientation=tpl["orientation"], art_url=art_url, slot=slot,
            watermark=watermark, headline=headline, closing=closing, photo_variants=photo_variants or {},
        ),
        webhook_url=webhook_url, client_data=client_data,
    )
