"""Endpoints de auth: login, refresh, logout, /me."""
from typing import Optional

from fastapi import APIRouter, Depends, Header, Request

from app.auth import service
from app.auth.dependencies import get_current_user
from app.auth.schemas import LoginRequest, RefreshRequest, TokenPair, UserPublic

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_ip(request: Request) -> Optional[str]:
    # Detrás de proxy (EasyPanel/Traefik) el IP real viene en X-Forwarded-For.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/login", response_model=TokenPair)
def login(
    payload: LoginRequest,
    request: Request,
    user_agent: Optional[str] = Header(default=None),
) -> TokenPair:
    return service.authenticate(payload.email, payload.password, _client_ip(request), user_agent)


@router.post("/refresh", response_model=TokenPair)
def refresh(
    payload: RefreshRequest,
    request: Request,
    user_agent: Optional[str] = Header(default=None),
) -> TokenPair:
    return service.refresh_tokens(payload.refresh_token, _client_ip(request), user_agent)


@router.post("/logout", status_code=204)
def logout(payload: RefreshRequest) -> None:
    service.logout(payload.refresh_token)


@router.get("/me", response_model=UserPublic)
def me(user: UserPublic = Depends(get_current_user)) -> UserPublic:
    return user
