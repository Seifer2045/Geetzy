"""Called by Supabase (pg_net / pg_cron) and by JSON2Video. Never by the app."""
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import pipeline
from ..auth import check_webhook_secret, require_internal
from ..services import song_design
from ..studio import service as studio_service
from ..video import movie_template, native_template, presets, song_spec

router = APIRouter()


@router.post("/internal/gifts/{gid}/run", dependencies=[Depends(require_internal)])
def internal_run(gid: str):
    return {"result": pipeline.run_gift(gid)}


@router.post("/internal/templates/{tid}/art", dependencies=[Depends(require_internal)])
def internal_template_art(tid: str):
    return {"result": studio_service.run_art(tid)}


@router.post("/internal/templates/{tid}/preview", dependencies=[Depends(require_internal)])
def internal_template_preview(tid: str):
    return {"result": studio_service.run_preview(tid)}


@router.post("/internal/templates/{tid}/song", dependencies=[Depends(require_internal)])
def internal_template_song(tid: str):
    return {"result": song_design.generate(tid)}


class ValidateSongInput(BaseModel):
    spec: dict | list | str | int | float | bool | None
    duration_sec: int | None = Field(default=None, ge=3, le=60)


@router.post("/internal/song/validate", dependencies=[Depends(require_internal)])
def internal_validate_song(body: ValidateSongInput):
    """Admin's song JSON editor: same rules on Save as when the song is generated."""
    return {"errors": song_spec.validate(body.spec, duration_sec=body.duration_sec)}


class ValidateMovieInput(BaseModel):
    movie: dict | list | str | int | float | bool | None  # whatever the admin pasted; validate() says what is wrong
    photos_min: int = Field(default=1, ge=1, le=10)
    photos_max: int = Field(default=5, ge=1, le=10)


@router.post("/internal/movie/validate", dependencies=[Depends(require_internal)])
def internal_validate_movie(body: ValidateMovieInput):
    """Used by the admin's Validate button and Save. Native JSON2Video JSON (from the Editor / a starter) and the older compact format."""
    check = native_template.validate if native_template.is_native(body.movie) else movie_template.validate
    return {"errors": check(body.movie, photos_min=body.photos_min, photos_max=min(body.photos_max, 10))}


@router.get("/internal/presets", dependencies=[Depends(require_internal)])
def internal_presets():
    """Starter templates for the admin: id, name, description, photo counts (no JSON, which is fetched one at a time)."""
    return {"presets": presets.summaries()}


@router.get("/internal/presets/{pid}", dependencies=[Depends(require_internal)])
def internal_preset(pid: str):
    preset = presets.get(pid)
    if not preset:
        raise HTTPException(404, "Starter template not found")
    return preset


@router.post("/internal/sweep", dependencies=[Depends(require_internal)])
def internal_sweep():
    return pipeline.sweep()


@router.post("/webhooks/json2video")
def json2video_webhook(secret: str, job: str, type: str = "gift", payload: dict[str, Any] = Body(default_factory=dict)):
    check_webhook_secret(secret)
    if payload.get("test"):
        return {"ok": True}
    if type == "template":  # admin's template preview
        return {"result": studio_service.on_template_preview_done(
            job, success=bool(payload.get("success")), video_url=payload.get("url"), error=payload.get("error"),
        )}
    result = pipeline.on_render_done(
        job, success=bool(payload.get("success")), video_url=payload.get("url"), error=payload.get("error"),
    )
    return {"result": result}
