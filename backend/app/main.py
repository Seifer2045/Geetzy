"""Geetzy API — FastAPI on Vercel, data in Supabase.

Layers:  api/ (HTTP routers)  →  services/ + pipeline.py (business steps)  →  providers/ (ElevenLabs, JSON2Video)
         studio/ (admin template jobs)  ·  db.py (Supabase)  ·  auth.py  ·  schemas.py (API contract)

Local:   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   (reads backend/.env)
Vercel:  auto-detected entrypoint app/main.py (see vercel.json for the time limit)
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import gifts, internal, payments, public
from .api.common import check_own_path as _check_own_path  # noqa: F401 — kept for tests
from .auth import AuthUser  # noqa: F401 — kept for tests
from fastapi import HTTPException  # noqa: F401 — kept for tests

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Geetzy API", version="1.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

for router in (public.router, gifts.router, payments.router, internal.router):
    app.include_router(router)
