"""Checks the Supabase login token the app sends as `Authorization: Bearer <token>`."""
import hmac
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Header, HTTPException

from .config import get_settings
from .db import db


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    url = f"{get_settings().supabase_url}/auth/v1/.well-known/jwks.json"
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


def _verify(token: str) -> AuthUser:
    try:
        key = _jwks().get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=["ES256", "RS256", "EdDSA"], audience="authenticated")
        return AuthUser(id=claims["sub"], email=claims.get("email"))
    except jwt.PyJWKClientError:
        # Project still on the old shared-secret (HS256) keys: ask Supabase instead.
        res = db().auth.get_user(token)
        if not res or not res.user:
            raise HTTPException(401, "Please sign in again.")
        return AuthUser(id=res.user.id, email=res.user.email)
    except jwt.PyJWTError:
        raise HTTPException(401, "Please sign in again.")


def current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please sign in.")
    return _verify(authorization.split(" ", 1)[1].strip())


def require_internal(x_internal_secret: str | None = Header(default=None)) -> None:
    if not x_internal_secret or not hmac.compare_digest(x_internal_secret, get_settings().internal_secret):
        raise HTTPException(403, "Forbidden")


def check_webhook_secret(secret: str) -> None:
    if not hmac.compare_digest(secret, get_settings().webhook_secret):
        raise HTTPException(403, "Forbidden")
