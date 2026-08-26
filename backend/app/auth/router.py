"""Endpoints de auth: login, refresh, logout, /me + self-service."""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.auth import service
from app.auth.dependencies import get_current_user
from app.auth.password import hash_password, verify_password
from app.auth.schemas import LoginRequest, RefreshRequest, TokenPair, UserPublic
from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Complejidad de contraseña ─────────────────────────────────────────
_MIN_PASS_LEN = 8


def _validate_password_complexity(password: str) -> None:
    if len(password) < _MIN_PASS_LEN:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"La contraseña debe tener al menos {_MIN_PASS_LEN} caracteres.",
        )
    if not any(c.isupper() for c in password):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "La contraseña debe incluir al menos una letra mayúscula.",
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "La contraseña debe incluir al menos un número.",
        )


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


# ─── Self-service: cambiar mis datos ────────────────────────────────────

class MeUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=120)
    last_name: Optional[str] = Field(default=None, max_length=120)
    # Nota: email NO es editable por el user — solo admin. Auditoría, integridad,
    # y prevención de account takeover pasan por esa restricción.


@router.patch("/me", response_model=UserPublic)
def update_me(payload: MeUpdate, user: UserPublic = Depends(get_current_user)) -> UserPublic:
    data = payload.model_dump(exclude_none=True)
    if not data:
        return user
    sets = ", ".join(f"{k} = %s" for k in data)
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            f"UPDATE auth.users SET {sets} WHERE id = %s"
            f" RETURNING id, email, first_name, last_name, role, trabajador_id, is_active, last_login_at;",
            (*data.values(), str(user.id)),
        )
        row = cur.fetchone()
    return UserPublic(**dict(row))


# ─── Self-service: cambiar mi contraseña ─────────────────────────────────

class ChangePasswordPayload(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=_MIN_PASS_LEN, max_length=200)


@router.post("/change-password", status_code=204)
def change_password(
    payload: ChangePasswordPayload,
    user: UserPublic = Depends(get_current_user),
) -> None:
    _validate_password_complexity(payload.new_password)

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT password_hash FROM auth.users WHERE id = %s;",
            (str(user.id),),
        )
        row = cur.fetchone()
        if not row or not verify_password(payload.current_password, row["password_hash"]):
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "La contraseña actual es incorrecta.",
            )

        cur.execute(
            "UPDATE auth.users SET password_hash = %s, password_must_change = false"
            " WHERE id = %s;",
            (hash_password(payload.new_password), str(user.id)),
        )
