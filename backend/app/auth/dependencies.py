"""FastAPI dependencies para proteger endpoints."""
from typing import Iterable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.auth import jwt as jwt_module
from app.auth import repository as repo
from app.auth.schemas import UserPublic

_bearer = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=True)


def get_current_user(token: str = Depends(_bearer)) -> UserPublic:
    try:
        payload = jwt_module.decode_token(token)
    except jwt_module.JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o expirado")

    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tipo de token incorrecto")

    user = repo.get_user_by_id(UUID(payload["sub"]))
    if not user or not user["is_active"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario inválido")

    return UserPublic(
        id=user["id"],
        email=user["email"],
        first_name=user.get("first_name"),
        last_name=user.get("last_name"),
        role=user["role"],
        trabajador_id=user.get("trabajador_id"),
        is_active=user["is_active"],
        last_login_at=user.get("last_login_at"),
    )


def require_role(*allowed: str):
    """Dependency factory: exige que el rol del usuario esté en `allowed`."""
    allowed_set = set(allowed)

    def _guard(user: UserPublic = Depends(get_current_user)) -> UserPublic:
        if user.role not in allowed_set:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes permiso para esta acción")
        return user

    return _guard
