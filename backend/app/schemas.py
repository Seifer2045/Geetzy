"""API contract — keep in sync with mobile/src/api/types.ts (camelCase on the wire)."""
from datetime import datetime
from typing import Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Occasion = Literal["birthday", "anniversary", "apology", "festival"]
TemplateStyle = Literal["bollywood", "retro", "genz"]
Mood = Literal["happy", "filmy", "romantic", "party"]
Singer = Literal["female", "male", "duet"]
GiftStatus = Literal["queued", "writing_lyrics", "composing", "rendering", "preview_ready", "paid", "failed"]
LibraryStatus = Literal["hd", "preview", "making", "draft", "photo"]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Template(Camel):
    id: str
    name: str
    occasion: Occasion
    style: TemplateStyle
    price: int  # INR, decided by the server
    original_price: Optional[int] = None
    currency: Literal["INR"] = "INR"
    duration_sec: int = 15
    photos_min: int = 3
    photos_max: int = 5
    made_count: int = 0
    description: str
    tags: list[str]
    colors: tuple[str, str]
    preview_url: Optional[str] = None
    trending: bool = False


class AiSongInput(Camel):
    type: Literal["ai"]
    mood: Mood
    singer: Singer
    version: int = Field(ge=1, le=3)
    lyrics: str = Field(default="", max_length=600)


class UploadSongInput(Camel):
    type: Literal["upload"]
    file_name: str = Field(max_length=200)
    storage_path: str  # gift-uploads bucket, must start with "{user_id}/"
    duration_sec: float = Field(gt=0)
    trim_start_sec: float = Field(ge=0)
    fade: bool = True


class CreateGiftInput(Camel):
    template_id: str
    recipient_name: str = Field(min_length=1, max_length=20)
    sender_name: str = Field(min_length=1, max_length=20)
    fun_fact: str = Field(default="", max_length=120)
    photo_paths: list[str] = Field(min_length=1, max_length=10)  # gift-uploads bucket
    song: Union[AiSongInput, UploadSongInput] = Field(discriminator="type")


class Gift(Camel):
    id: str
    template_id: str
    template_name: str
    occasion: Occasion
    recipient_name: str
    sender_name: str
    status: GiftStatus
    progress: float
    created_at: datetime
    preview_url: Optional[str] = None
    hd_url: Optional[str] = None
    colors: tuple[str, str]
    price: int


class LibraryItem(Camel):
    id: str
    kind: Literal["video", "photo", "draft"]
    title: str
    subtitle: str
    status: LibraryStatus
    progress: float
    colors: tuple[str, str]
    gift_id: Optional[str] = None
    created_at: datetime


class LyricsInput(Camel):
    template_id: str
    recipient_name: str = Field(min_length=1, max_length=20)
    fun_fact: str = Field(default="", max_length=120)
    mood: Mood
    singer: Singer
    version: int = Field(ge=1, le=3)


class AiSong(Camel):
    title: str
    lyrics: str
    versions: int = 3
    retries_left: int


class VerifyPaymentInput(Camel):
    gift_id: str
    purchase_token: Optional[str] = None  # from Google Play Billing
