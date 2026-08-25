"""Lógica de negocio de auth: login, refresh, logout."""
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.auth import jwt as jwt_module
from app.auth import password as pwd
from app.auth import repository as repo
from app.auth.schemas import TokenPair, UserPublic


def _to_public(row: dict) -> UserPublic:
    return UserPublic(
        id=row["id"],
        email=row["email"],
        first_name=row.get("first_name"),
        last_name=row.get("last_name"),
        role=row["role"],
        trabajador_id=row.get("trabajador_id"),
        is_active=row["is_active"],
        last_login_at=row.get("last_login_at"),
    )


def authenticate(email: str, plain_password: str, ip: Optional[str], user_agent: Optional[str]) -> TokenPair:
    user = repo.get_user_by_email(email)

    if not user:
        repo.log_login_attempt(email, ip, success=False, error="user_not_found")
        # Mensaje genérico para no filtrar existencia de emails.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas")

    if not user["is_active"]:
        repo.log_login_attempt(email, ip, success=False, error="user_inactive")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Usuario deshabilitado")

    if not pwd.verify_password(plain_password, user["password_hash"]):
        repo.log_login_attempt(email, ip, success=False, error="bad_password")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas")

    access = jwt_module.create_access_token(user["id"], user["role"])
    refresh, expires_at = jwt_module.create_refresh_token(user["id"])
    repo.create_session(user["id"], refresh, expires_at, user_agent, ip)
    repo.update_last_login(user["id"])
    repo.log_login_attempt(email, ip, success=True)

    return TokenPair(access_token=access, refresh_token=refresh, user=_to_public(user))


def refresh_tokens(refresh_token: str, ip: Optional[str], user_agent: Optional[str]) -> TokenPair:
    try:
        payload = jwt_module.decode_token(refresh_token)
    except jwt_module.JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token inválido")

    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tipo de token incorrecto")

    if not repo.session_is_active(refresh_token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión revocada o expirada")

    user_id = UUID(payload["sub"])
    user = repo.get_user_by_id(user_id)
    if not user or not user["is_active"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario inválido")

    # Rotación: revocar el refresh viejo y emitir uno nuevo.
    repo.revoke_session_by_refresh(refresh_token)
    access = jwt_module.create_access_token(user["id"], user["role"])
    new_refresh, expires_at = jwt_module.create_refresh_token(user["id"])
    repo.create_session(user["id"], new_refresh, expires_at, user_agent, ip)

    return TokenPair(access_token=access, refresh_token=new_refresh, user=_to_public(user))


def logout(refresh_token: str) -> None:
    repo.revoke_session_by_refresh(refresh_token)
