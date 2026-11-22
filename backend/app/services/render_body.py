"""One place that decides HOW a video is described to JSON2Video:
the template's own movie JSON (written by Grok or the admin) when it has one, else the built-in design.
Used by real gifts (pipeline.py) and by the admin's template preview (studio/service.py)."""
import logging

from ..studio.layouts import Slot
from ..video import movie_template as mt
from ..video.json2video import MovieInput, build_movie

log = logging.getLogger("geetzy.render")


def movie_body(
    tpl: dict, *, kind: str, occasion: str, recipient: str, sender: str, fun_fact: str, photo_urls: list[str],
    audio_url: str | None, audio_seek: float, fade: bool, lyric_lines: list[str], art_url: str | None,
    background_url: str | None, slot: Slot | None, watermark: bool, webhook_url: str, client_data: dict[str, str],
    headline: str = "", closing: str = "",
) -> dict:
    movie_json = tpl.get("movie_json")
    if movie_json:
        try:
            body = mt.render_template(movie_json, mt.RenderContext(
                kind=kind,  # type: ignore[arg-type]
                photo_urls=photo_urls, duration_sec=tpl["duration_sec"], audio_url=audio_url, audio_seek=audio_seek, fade=fade,
                art_url=art_url, background_url=background_url, color_to=tpl["color_to"], watermark=watermark,
                values={"name": recipient, "sender": sender, "fun_fact": fun_fact, "occasion": occasion},
            ))
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
            watermark=watermark, headline=headline, closing=closing,
        ),
        webhook_url=webhook_url, client_data=client_data,
    )
