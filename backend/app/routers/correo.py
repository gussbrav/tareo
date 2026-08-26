"""Endpoints de configuración SMTP y prueba de envío.

Todos los endpoints requieren rol admin. La contraseña SMTP nunca se
devuelve en claro — GET la enmascara. Para actualizarla, PUT la manda
en claro (HTTPS mediante).
"""
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.auth.dependencies import require_role
from app.auth.schemas import UserPublic
from app.database import get_db
from app.services.mailer import test_smtp_connection

router = APIRouter(
    prefix="/api/admin/correo",
    tags=["correo"],
    dependencies=[Depends(require_role("admin"))],
)


_KEYS = (
    "smtp_host", "smtp_port", "smtp_user", "smtp_password",
    "smtp_from", "smtp_use_tls", "smtp_reject_unauthorized",
)


class SmtpConfig(BaseModel):
    smtp_host: str = ""
    smtp_port: str = "587"
    smtp_user: str = ""
    smtp_password: str = ""  # write-only. GET la enmascara.
    smtp_from: str = ""
    smtp_use_tls: bool = True
    smtp_reject_unauthorized: bool = True


class SmtpConfigResponse(BaseModel):
    smtp_host: str
    smtp_port: str
    smtp_user: str
    smtp_password_set: bool  # true si hay password guardada; nunca devolvemos el valor
    smtp_from: str
    smtp_use_tls: bool
    smtp_reject_unauthorized: bool


def _read_all() -> Dict[str, str]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT key, COALESCE(value,'') AS value FROM public.system_settings"
            " WHERE key = ANY(%s);",
            (list(_KEYS),),
        )
        return {r["key"]: r["value"] for r in cur.fetchall()}


def _bool(s: str) -> bool:
    return s.strip().lower() in ("true", "1", "yes", "y", "on")


@router.get("", response_model=SmtpConfigResponse)
def get_smtp_config():
    d = _read_all()
    return SmtpConfigResponse(
        smtp_host=d.get("smtp_host", ""),
        smtp_port=d.get("smtp_port", "587"),
        smtp_user=d.get("smtp_user", ""),
        smtp_password_set=bool(d.get("smtp_password")),
        smtp_from=d.get("smtp_from", ""),
        smtp_use_tls=_bool(d.get("smtp_use_tls", "true")),
        smtp_reject_unauthorized=_bool(d.get("smtp_reject_unauthorized", "true")),
    )


@router.put("", response_model=SmtpConfigResponse)
def update_smtp_config(payload: SmtpConfig):
    """Actualiza los settings SMTP. Si el password viene vacío, NO se
    sobreescribe el actual — permite editar otros campos sin re-tipear la pass."""
    updates = {
        "smtp_host": payload.smtp_host.strip(),
        "smtp_port": payload.smtp_port.strip() or "587",
        "smtp_user": payload.smtp_user.strip(),
        "smtp_from": payload.smtp_from.strip(),
        "smtp_use_tls": "true" if payload.smtp_use_tls else "false",
        "smtp_reject_unauthorized": "true" if payload.smtp_reject_unauthorized else "false",
    }
    if payload.smtp_password:
        updates["smtp_password"] = payload.smtp_password

    with get_db() as conn, conn.cursor() as cur:
        for k, v in updates.items():
            cur.execute(
                "UPDATE public.system_settings SET value = %s WHERE key = %s;",
                (v, k),
            )
    return get_smtp_config()


class TestSendPayload(BaseModel):
    to: EmailStr = Field(..., description="Email destinatario para la prueba")


@router.post("/test", status_code=status.HTTP_204_NO_CONTENT)
def send_test_email(
    payload: TestSendPayload,
    _user: UserPublic = Depends(require_role("admin")),
):
    """Envía un email de prueba al destinatario indicado. Usa la config
    SMTP actualmente guardada — si falla lo dice claro con el error real."""
    test_smtp_connection(payload.to)
