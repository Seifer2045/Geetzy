"""Vercel entrypoint. Vercel's FastAPI detection looks for `app` in index.py; the real app lives in app/main.py."""
from app.main import app

__all__ = ["app"]
