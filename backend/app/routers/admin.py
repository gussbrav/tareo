"""Admin panel: CRUD de trabajadores y usuarios. Solo rol admin."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.auth.dependencies import require_role
from app.auth.password import hash_password
from app.database import get_db

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])


# ============================================================
# Trabajadores
# ============================================================

class TrabajadorCreate(BaseModel):
    nbrcompleto: str = Field(..., min_length=1, max_length=255)
    numidentificacion: Optional[str] = Field(default=None, max_length=50)
    descategoriatrabajador: Optional[str] = Field(default=None, max_length=100)
    desestadotrabajador: str = Field(default="activo", max_length=100)
    flgativotrabajador: bool = True


class TrabajadorUpdate(BaseModel):
    nbrcompleto: Optional[str] = Field(default=None, min_length=1, max_length=255)
    numidentificacion: Optional[str] = Field(default=None, max_length=50)
    descategoriatrabajador: Optional[str] = Field(default=None, max_length=100)
    desestadotrabajador: Optional[str] = Field(default=None, max_length=100)
    flgativotrabajador: Optional[bool] = None


@router.get("/trabajadores")
def list_trabajadores():
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM construccion.m_trabajador ORDER BY nbrcompleto;"
        )
        return [dict(r) for r in cur.fetchall()]


@router.post("/trabajadores", status_code=201)
def create_trabajador(payload: TrabajadorCreate):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO construccion.m_trabajador
                (nbrcompleto, numidentificacion, descategoriatrabajador,
                 desestadotrabajador, flgativotrabajador)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *;
            """,
            (
                payload.nbrcompleto.strip().upper(),
                payload.numidentificacion,
                payload.descategoriatrabajador,
                payload.desestadotrabajador,
                payload.flgativotrabajador,
            ),
        )
        return dict(cur.fetchone())


@router.patch("/trabajadores/{trabajador_id}")
def update_trabajador(trabajador_id: UUID, payload: TrabajadorUpdate):
    data = payload.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin cambios")
    if "nbrcompleto" in data:
        data["nbrcompleto"] = data["nbrcompleto"].strip().upper()
    sets = ", ".join(f"{k} = %s" for k in data)
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            f"UPDATE construccion.m_trabajador SET {sets} WHERE id = %s RETURNING *;",
            (*data.values(), str(trabajador_id)),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trabajador no encontrado")
        return dict(row)


@router.delete("/trabajadores/{trabajador_id}", status_code=204)
def delete_trabajador(trabajador_id: UUID):
    """Soft-delete: marca como inactivo. Mantiene FK con actividades históricas."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE construccion.m_trabajador
               SET flgativotrabajador = false,
                   desestadotrabajador = 'inactivo'
             WHERE id = %s;
            """,
            (str(trabajador_id),),
        )
        if cur.rowcount == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trabajador no encontrado")


# ============================================================
# Usuarios
# ============================================================

Role = str  # validado abajo


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=200)
    first_name: Optional[str] = Field(default=None, max_length=120)
    last_name: Optional[str] = Field(default=None, max_length=120)
    role: str = Field(..., pattern="^(admin|supervisor|trabajador)$")
    trabajador_id: Optional[UUID] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=120)
    last_name: Optional[str] = Field(default=None, max_length=120)
    role: Optional[str] = Field(default=None, pattern="^(admin|supervisor|trabajador)$")
    trabajador_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=200)


@router.get("/usuarios")
def list_users():
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.email, u.first_name, u.last_name, u.role,
                   u.trabajador_id, u.is_active, u.created_at, u.last_login_at,
                   t.nbrcompleto AS trabajador_nombre
              FROM auth.users u
              LEFT JOIN construccion.m_trabajador t ON t.id = u.trabajador_id
             ORDER BY u.email;
            """
        )
        return [dict(r) for r in cur.fetchall()]


@router.post("/usuarios", status_code=201)
def create_user(payload: UserCreate):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM auth.users WHERE lower(email) = lower(%s);", (payload.email,))
        if cur.fetchone():
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese correo")

        cur.execute(
            """
            INSERT INTO auth.users
                (email, password_hash, first_name, last_name, role, trabajador_id, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, email, first_name, last_name, role, trabajador_id, is_active, created_at;
            """,
            (
                payload.email.lower(),
                hash_password(payload.password),
                payload.first_name,
                payload.last_name,
                payload.role,
                str(payload.trabajador_id) if payload.trabajador_id else None,
                payload.is_active,
            ),
        )
        return dict(cur.fetchone())


@router.patch("/usuarios/{user_id}")
def update_user(user_id: UUID, payload: UserUpdate):
    data = payload.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin cambios")

    if "password" in data:
        data["password_hash"] = hash_password(data.pop("password"))
    if "trabajador_id" in data and data["trabajador_id"] is not None:
        data["trabajador_id"] = str(data["trabajador_id"])

    sets = ", ".join(f"{k} = %s" for k in data)
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE auth.users SET {sets}
             WHERE id = %s
         RETURNING id, email, first_name, last_name, role, trabajador_id, is_active, last_login_at;
            """,
            (*data.values(), str(user_id)),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
        return dict(row)


@router.delete("/usuarios/{user_id}", status_code=204)
def delete_user(user_id: UUID):
    """Soft-delete: desactiva. Preserva integridad con audit de sesiones/actividades."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute("UPDATE auth.users SET is_active = false WHERE id = %s;", (str(user_id),))
        if cur.rowcount == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
