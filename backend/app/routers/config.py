"""Endpoints de configuración editable — permisos, settings, info del sistema.

Todos los endpoints requieren `admin.acceso` como mínimo. La lectura pública
de settings (branding sin ediciones) se expone también en /api/config/public.
"""
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user, require_role
from app.auth.permissions import (
    _load_matrix as reload_matrix,  # noqa: F401 (por si se quiere forzar)
    invalidate_cache as invalidate_perm_cache,
)
from app.auth.schemas import UserPublic
from app.config import get_settings
from app.database import get_db

router = APIRouter(prefix="/api/config", tags=["config"])


# ─────────────────────────────────────────────────────────────────────────────
# GET público (sin auth) — branding mínimo para pantallas de login, etc.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/public")
def public_settings() -> Dict[str, str]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT key, value FROM public.system_settings
             WHERE key IN (
               'company_name', 'company_taxid', 'app_environment_label',
               'logo_url', 'favicon_url', 'brand_primary_color', 'brand_accent_color'
             );
            """
        )
        return {r["key"]: r["value"] or "" for r in cur.fetchall()}


# ─────────────────────────────────────────────────────────────────────────────
# General — info del sistema (read-only)
# ─────────────────────────────────────────────────────────────────────────────

class SystemStatus(BaseModel):
    api_status: str
    api_name: str
    db_status: str
    db_engine: str
    version: str
    build_time: str
    environment: str
    company_name: str
    developed_by: str = "Azoramind"


@router.get("/general", response_model=SystemStatus)
def system_general(_: UserPublic = Depends(require_role("admin", "supervisor"))) -> SystemStatus:
    s = get_settings()
    db_ok = False
    try:
        with get_db() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1;")
            cur.fetchone()
            db_ok = True
    except Exception:
        db_ok = False
    db_engine = "PostgreSQL — Base de datos principal"

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT value FROM public.system_settings WHERE key='company_name' LIMIT 1;"
        )
        row = cur.fetchone()
        company = (row["value"] if row and row["value"] else s.app_name)
        cur.execute(
            "SELECT value FROM public.system_settings WHERE key='app_environment_label' LIMIT 1;"
        )
        row = cur.fetchone()
        env_label = row["value"] if row and row["value"] else s.app_env

    return SystemStatus(
        api_status="up",
        api_name="FastAPI — Servidor principal",
        db_status="up" if db_ok else "down",
        db_engine=db_engine,
        version="0.1.0",
        build_time=datetime.utcnow().isoformat(timespec="seconds") + "Z",
        environment=env_label,
        company_name=company,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Settings (Marca / branding editable) — requiere admin
# ─────────────────────────────────────────────────────────────────────────────

class SettingItem(BaseModel):
    key: str
    value: str = ""
    description: str = ""
    updated_at: datetime | None = None


class SettingUpdate(BaseModel):
    # 2 MB alcanza para un logo PNG base64 razonable (típico: 20-200 KB).
    value: str = Field(..., max_length=2_000_000)


@router.get("/settings", response_model=List[SettingItem])
def list_settings(_: UserPublic = Depends(require_role("admin"))):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT key, COALESCE(value, '') AS value,
                   COALESCE(description, '') AS description,
                   updated_at
              FROM public.system_settings
             ORDER BY key;
            """
        )
        return [dict(r) for r in cur.fetchall()]


@router.patch("/settings/{key}", response_model=SettingItem)
def update_setting(
    key: str,
    payload: SettingUpdate,
    user: UserPublic = Depends(require_role("admin")),
):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE public.system_settings
               SET value = %s, updated_by = %s
             WHERE key = %s
         RETURNING key, COALESCE(value, '') AS value,
                   COALESCE(description, '') AS description, updated_at;
            """,
            (payload.value, str(user.id), key),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Setting '{key}' no encontrado")
        return dict(row)


# ─────────────────────────────────────────────────────────────────────────────
# Roles y permisos (matriz editable)
# ─────────────────────────────────────────────────────────────────────────────

class PermissionRow(BaseModel):
    role: str
    permission_key: str
    allowed: bool


class PermissionToggle(BaseModel):
    role: str = Field(..., pattern="^(admin|supervisor|trabajador)$")
    permission_key: str = Field(..., min_length=1, max_length=80)
    allowed: bool


@router.get("/permissions", response_model=List[PermissionRow])
def list_permissions(_: UserPublic = Depends(require_role("admin"))):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT role, permission_key, allowed
              FROM auth.role_permissions
             ORDER BY permission_key, role;
            """
        )
        return [dict(r) for r in cur.fetchall()]


@router.post("/permissions", response_model=PermissionRow)
def toggle_permission(
    payload: PermissionToggle,
    user: UserPublic = Depends(require_role("admin")),
):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO auth.role_permissions (role, permission_key, allowed, updated_by)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (role, permission_key)
            DO UPDATE SET allowed = EXCLUDED.allowed,
                          updated_by = EXCLUDED.updated_by,
                          updated_at = now()
            RETURNING role, permission_key, allowed;
            """,
            (payload.role, payload.permission_key, payload.allowed, str(user.id)),
        )
        row = dict(cur.fetchone())
    invalidate_perm_cache()
    return row


class MyPermissions(BaseModel):
    role: str
    permissions: List[str]


@router.get("/my-permissions", response_model=MyPermissions)
def my_permissions(user: UserPublic = Depends(get_current_user)):
    """Endpoint público (auth-required) — la UI lo consume para ocultar/mostrar features."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT permission_key FROM auth.role_permissions
             WHERE role = %s AND allowed = true
             ORDER BY permission_key;
            """,
            (user.role,),
        )
        keys = [r["permission_key"] for r in cur.fetchall()]
    return MyPermissions(role=user.role, permissions=keys)
