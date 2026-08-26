"""Endpoints de invitaciones — admin crea, usuario acepta.

Flujo:
    1. Admin POST /api/admin/invitations con email + rol + proyectos
    2. Backend genera token único, guarda en auth.invitations, manda email
       con link https://tareo.azoramind.com/aceptar/{token}
    3. Usuario clickea el link → frontend GET /api/auth/invitations/{token}
       para validar → muestra form de contraseña
    4. Usuario POST /api/auth/invitations/{token}/accept con password →
       backend crea auth.users, aplica proyectos M:N, marca la invitación
       como usada, devuelve tokens JWT (login automático)

Diseño:
    - Un email puede tener múltiples invitaciones pendientes (raro pero legal).
      Al aceptar UNA, las demás quedan vencidas por (a) crear el user y ya
      existir en auth.users, o (b) expiración natural.
    - No dejamos aceptar una invitación si ya existe un usuario activo con
      ese email — el admin debe cancelar la invitación o resetear la pass
      del user existente.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.auth import jwt as jwt_module
from app.auth import repository as auth_repo
from app.auth.dependencies import get_current_user, require_role
from app.auth.password import hash_password, verify_password  # noqa: F401 (verify usado en change-pass)
from app.auth.schemas import UserPublic
from app.config import get_settings
from app.database import get_db
from app.services.mailer import is_smtp_configured, send_mail

INVITATION_TTL_DAYS = 7
_MIN_PASS_LEN = 8


admin_router = APIRouter(
    prefix="/api/admin/invitations",
    tags=["invitations-admin"],
    dependencies=[Depends(require_role("admin"))],
)

public_router = APIRouter(
    prefix="/api/auth/invitations",
    tags=["invitations-public"],
)


# ─── Schemas ─────────────────────────────────────────────────────────────

class InvitationCreate(BaseModel):
    email: EmailStr
    role: str = Field(..., pattern="^(admin|supervisor|trabajador)$")
    first_name: Optional[str] = Field(default=None, max_length=120)
    last_name: Optional[str] = Field(default=None, max_length=120)
    trabajador_id: Optional[UUID] = None
    proyecto_ids: List[UUID] = Field(default_factory=list)


class InvitationOut(BaseModel):
    id: UUID
    email: str
    role: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    trabajador_id: Optional[UUID] = None
    proyecto_ids: List[UUID] = Field(default_factory=list)
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime


class InvitationPublic(BaseModel):
    """Payload devuelto por GET público — datos mínimos para renderizar el form."""
    email: str
    role: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    expires_at: datetime
    valid: bool


class AcceptInvitationPayload(BaseModel):
    password: str = Field(..., min_length=_MIN_PASS_LEN, max_length=200)


class TokenBundle(BaseModel):
    access_token: str
    refresh_token: str
    user: UserPublic


# ─── Helpers ─────────────────────────────────────────────────────────────

def _new_token() -> str:
    """URL-safe token de ~43 chars. Suficiente entropía para invitaciones."""
    return secrets.token_urlsafe(32)


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


def _base_url() -> str:
    """URL pública del frontend para armar el link de aceptación.
    Toma allowed_origins[0] si es una URL absoluta; sino cae al default."""
    s = get_settings()
    origins = [o.strip() for o in (s.allowed_origins or "").split(",") if o.strip()]
    for o in origins:
        if o.startswith("http"):
            return o.rstrip("/")
    return "https://tareo.azoramind.com"


def _send_invitation_email(email: str, token: str, first_name: Optional[str]) -> None:
    link = f"{_base_url()}/aceptar/{token}"
    saludo = f"Hola {first_name}," if first_name else "Hola,"
    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
      <h2 style="color:#1E40AF;margin:0 0 12px">Te invitamos a Tareo</h2>
      <p>{saludo}</p>
      <p>El administrador te dio acceso a <strong>Tareo</strong> —
         la plataforma de control de actividades y horas hombre.</p>
      <p>Hacé clic en el siguiente botón para activar tu cuenta y elegir tu contraseña:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="{link}"
           style="background:#1E40AF;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Activar mi cuenta
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">
        Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
        <a href="{link}" style="color:#1E40AF;word-break:break-all">{link}</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px">
        Este link es de un solo uso y expira en {INVITATION_TTL_DAYS} días.
        Si no esperabas este correo podés ignorarlo — sin la activación no se crea ningún usuario.
      </p>
    </div>
    """
    text = (
        f"{saludo}\n\n"
        f"El administrador te invitó a Tareo. Activá tu cuenta acá:\n{link}\n\n"
        f"El link expira en {INVITATION_TTL_DAYS} días."
    )
    send_mail(to=email, subject="[Tareo] Activá tu cuenta", html=html, text=text)


# ─── Admin: crear / listar / reenviar / cancelar ────────────────────────

@admin_router.get("", response_model=List[InvitationOut])
def list_invitations(only_pending: bool = True):
    q = """
        SELECT id, email, role, first_name, last_name, trabajador_id,
               proyecto_ids, expires_at, used_at, created_at
          FROM auth.invitations
    """
    if only_pending:
        q += " WHERE used_at IS NULL AND expires_at > now()"
    q += " ORDER BY created_at DESC;"
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(q)
        return [dict(r) for r in cur.fetchall()]


@admin_router.post("", status_code=201, response_model=InvitationOut)
def create_invitation(payload: InvitationCreate, user: UserPublic = Depends(require_role("admin"))):
    if not is_smtp_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "El servidor de correo no está configurado. "
            "Configura SMTP en Configuración → Correo antes de invitar usuarios.",
        )

    # Chequeo: ya existe user con ese email?
    with get_db() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM auth.users WHERE lower(email) = lower(%s);", (payload.email,))
        if cur.fetchone():
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Ya existe un usuario con el email {payload.email}. "
                "Si querés que resetee su contraseña, hacelo desde el panel de Usuarios.",
            )

        token = _new_token()
        expires_at = datetime.now(timezone.utc) + timedelta(days=INVITATION_TTL_DAYS)
        cur.execute(
            """
            INSERT INTO auth.invitations
                (token, email, role, first_name, last_name, trabajador_id,
                 proyecto_ids, invited_by, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s::uuid[], %s, %s)
            RETURNING id, email, role, first_name, last_name, trabajador_id,
                      proyecto_ids, expires_at, used_at, created_at;
            """,
            (
                token,
                payload.email.lower(),
                payload.role,
                payload.first_name,
                payload.last_name,
                str(payload.trabajador_id) if payload.trabajador_id else None,
                [str(p) for p in payload.proyecto_ids],
                str(user.id),
                expires_at,
            ),
        )
        row = dict(cur.fetchone())

    # Enviar email fuera del with — si falla, la invitación queda en DB y
    # el admin puede reenviarla. El error se propaga al frontend.
    _send_invitation_email(payload.email, token, payload.first_name)
    return row


@admin_router.post("/{inv_id}/resend", response_model=InvitationOut)
def resend_invitation(inv_id: UUID):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, token, email, role, first_name, last_name, trabajador_id,"
            " proyecto_ids, expires_at, used_at, created_at"
            " FROM auth.invitations WHERE id = %s;",
            (str(inv_id),),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitación no encontrada")
        if row["used_at"]:
            raise HTTPException(status.HTTP_409_CONFLICT, "Esta invitación ya fue aceptada")

        # Renovar token + expiración para "empezar el reloj otra vez"
        new_token = _new_token()
        new_expiry = datetime.now(timezone.utc) + timedelta(days=INVITATION_TTL_DAYS)
        cur.execute(
            "UPDATE auth.invitations SET token = %s, expires_at = %s"
            " WHERE id = %s RETURNING id, email, role, first_name, last_name,"
            " trabajador_id, proyecto_ids, expires_at, used_at, created_at;",
            (new_token, new_expiry, str(inv_id)),
        )
        updated = dict(cur.fetchone())

    _send_invitation_email(updated["email"], new_token, updated.get("first_name"))
    return updated


@admin_router.delete("/{inv_id}", status_code=204)
def cancel_invitation(inv_id: UUID):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "DELETE FROM auth.invitations WHERE id = %s AND used_at IS NULL;",
            (str(inv_id),),
        )
        if cur.rowcount == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitación no encontrada o ya aceptada")


# ─── Público: validar token / aceptar ───────────────────────────────────

def _find_invitation(token: str) -> dict:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, role, first_name, last_name, trabajador_id,"
            " proyecto_ids, expires_at, used_at"
            " FROM auth.invitations WHERE token = %s;",
            (token,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitación no encontrada o inválida")
    return dict(row)


@public_router.get("/{token}", response_model=InvitationPublic)
def validate_invitation(token: str):
    inv = _find_invitation(token)
    now = datetime.now(timezone.utc)
    expires_at = inv["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    valid = inv["used_at"] is None and expires_at > now
    return InvitationPublic(
        email=inv["email"],
        role=inv["role"],
        first_name=inv.get("first_name"),
        last_name=inv.get("last_name"),
        expires_at=expires_at,
        valid=valid,
    )


@public_router.post("/{token}/accept", response_model=TokenBundle)
def accept_invitation(token: str, payload: AcceptInvitationPayload):
    inv = _find_invitation(token)
    if inv["used_at"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "Esta invitación ya fue aceptada")
    now = datetime.now(timezone.utc)
    expires_at = inv["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        raise HTTPException(
            status.HTTP_410_GONE,
            "Esta invitación expiró. Pedile al admin que te reenvíe una nueva.",
        )

    _validate_password_complexity(payload.password)

    with get_db() as conn, conn.cursor() as cur:
        # Doble-check: ¿alguien creó ese user en el mientras tanto?
        cur.execute("SELECT id FROM auth.users WHERE lower(email) = lower(%s);", (inv["email"],))
        existing = cur.fetchone()
        if existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Ya existe un usuario con ese email. Pedile al admin que resetee tu contraseña.",
            )

        cur.execute(
            """
            INSERT INTO auth.users
                (email, password_hash, first_name, last_name, role, trabajador_id, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, true)
            RETURNING id, email, first_name, last_name, role, trabajador_id, is_active, last_login_at;
            """,
            (
                inv["email"],
                hash_password(payload.password),
                inv.get("first_name"),
                inv.get("last_name"),
                inv["role"],
                str(inv["trabajador_id"]) if inv.get("trabajador_id") else None,
            ),
        )
        new_user = dict(cur.fetchone())

        # Aplicar asignaciones de proyecto que quedaron guardadas en la invitación
        proyecto_ids = inv.get("proyecto_ids") or []
        if proyecto_ids and inv["role"] != "admin":
            for pid in proyecto_ids:
                cur.execute(
                    "INSERT INTO auth.user_proyecto (user_id, proyecto_id)"
                    " VALUES (%s, %s) ON CONFLICT DO NOTHING;",
                    (str(new_user["id"]), str(pid)),
                )

        # Marcar invitación como usada
        cur.execute(
            "UPDATE auth.invitations SET used_at = now(), used_by = %s"
            " WHERE id = %s;",
            (str(new_user["id"]), str(inv["id"])),
        )

    # Auto-login: emitir tokens (mismo patrón que auth/service.py login)
    access = jwt_module.create_access_token(new_user["id"], new_user["role"])
    refresh, refresh_exp = jwt_module.create_refresh_token(new_user["id"])
    auth_repo.create_session(new_user["id"], refresh, refresh_exp, user_agent=None, ip=None)
    return TokenBundle(
        access_token=access,
        refresh_token=refresh,
        user=UserPublic(**{k: new_user[k] for k in (
            "id", "email", "first_name", "last_name", "role", "trabajador_id", "is_active", "last_login_at"
        )}),
    )
