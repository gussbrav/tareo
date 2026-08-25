"""Emisión y verificación de JWT (access + refresh)."""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from uuid import UUID

from jose import JWTError, jwt

from app.config import get_settings


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: UUID, role: str, extra: Dict[str, Any] | None = None) -> str:
    settings = get_settings()
    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": _now_utc(),
        "exp": _now_utc() + timedelta(minutes=settings.jwt_access_token_expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: UUID) -> tuple[str, datetime]:
    settings = get_settings()
    expires_at = _now_utc() + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": _now_utc(),
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_token(token: str) -> Dict[str, Any]:
    """Levanta JWTError si el token es inválido o expiró."""
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


__all__ = ["create_access_token", "create_refresh_token", "decode_token", "JWTError"]
