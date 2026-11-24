import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from environment variables (Vercel) or backend/.env (local)."""

    # str_strip_whitespace: a pasted key with a stray space/newline would otherwise break auth checks.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", str_strip_whitespace=True)

    supabase_url: str
    supabase_secret_key: str
    json2video_api_key: str
    internal_secret: str
    webhook_secret: str
    public_base_url: str = ""
    allow_fake_payments: bool = False

    # AI songs: ElevenLabs Music. Empty key = AI songs fail with a clear message (own songs still work).
    elevenlabs_api_key: str = ""
    elevenlabs_model: str = "music_v1"
    # The personal song the user makes on the song screen: ONE per create flow (draft id), plus a daily cap per user.
    song_drafts_per_day: int = 5

    # The voice that SPEAKS the person's name over the shared song (JSON2Video "voice" element). Names are from memory:
    # verify voice name + model on the first real render. Chosen here, never by a template.
    name_voice: str = "en-IN-NeerjaNeural"
    name_voice_model: str = "azure"
    song_jobs_per_day: int = 30  # ElevenLabs shared-song generations from the admin, all admins together


    @property
    def base_url(self) -> str:
        """Public URL of this API (used for the JSON2Video webhook)."""
        if self.public_base_url:
            return self.public_base_url.rstrip("/")
        vercel_host = os.environ.get("VERCEL_PROJECT_PRODUCTION_URL") or os.environ.get("VERCEL_URL")
        if vercel_host:
            return f"https://{vercel_host}"
        raise RuntimeError("Set PUBLIC_BASE_URL so JSON2Video can call the webhook.")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
