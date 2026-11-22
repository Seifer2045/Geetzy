"""Called by Supabase (pg_net / pg_cron) and by JSON2Video. Never by the app."""
from typing import Any

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from .. import pipeline
from ..auth import check_webhook_secret, require_internal
from ..services import movie_design
from ..studio import service as studio_service
from ..video import movie_template

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


@router.post("/internal/templates/{tid}/movie", dependencies=[Depends(require_internal)])
def internal_template_movie(tid: str):
    return {"result": movie_design.generate(tid)}


class ValidateMovieInput(BaseModel):
    movie: dict | list | str | int | float | bool | None  # whatever the admin pasted; validate() says what is wrong
    photos_min: int = Field(default=1, ge=1, le=10)
    photos_max: int = Field(default=5, ge=1, le=10)


@router.post("/internal/movie/validate", dependencies=[Depends(require_internal)])
def internal_validate_movie(body: ValidateMovieInput):
    """Used by the admin's Validate button and Save: one set of rules for Grok output and hand-edited JSON."""
    return {"errors": movie_template.validate(body.movie, photos_min=body.photos_min, photos_max=min(body.photos_max, 10))}


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
