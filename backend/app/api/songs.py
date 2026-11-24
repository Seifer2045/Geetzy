"""The personal song screen: make ONE song on the phone before the gift exists."""
from fastapi import APIRouter, Depends

from ..auth import AuthUser, current_user
from ..schemas import SongDraft, SongDraftInput
from ..services.song_draft import make_draft
from .common import ensure_active

router = APIRouter()


@router.post("/songs/draft", response_model=SongDraft, response_model_by_alias=True)
def song_draft(body: SongDraftInput, user: AuthUser = Depends(current_user)):
    ensure_active(user)
    return make_draft(user, body)
