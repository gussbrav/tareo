"""Admin panel: CRUD de trabajadores, usuarios y catálogos maestros. Solo rol admin."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, EmailStr, Field
from psycopg2.errors import UniqueViolation

from app.services.ceco_importer import (
    build_template_xlsx,
    build_snapshot_xlsx,
    parse_ceco_workbook,
    import_to_proyecto,
)

from app.auth.dependencies import require_role
from app.auth.password import hash_password
from app.database import get_db

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_role("admin"))],
)


# ============================================================
# Trabajadores
# ============================================================

class TrabajadorCreate(BaseModel):
    nbrcompleto: str = Field(..., min_length=1, max_length=255)
    numidentificacion: Optional[str] = Field(default=None, max_length=50)
    categoria_id: Optional[UUID] = None
    descategoriatrabajador: Optional[str] = Field(default=None, max_length=100)  # legacy free-text
    desestadotrabajador: str = Field(default="activo", max_length=100)
    flgativotrabajador: bool = True


class TrabajadorUpdate(BaseModel):
    nbrcompleto: Optional[str] = Field(default=None, min_length=1, max_length=255)
    numidentificacion: Optional[str] = Field(default=None, max_length=50)
    categoria_id: Optional[UUID] = None
    descategoriatrabajador: Optional[str] = Field(default=None, max_length=100)
    desestadotrabajador: Optional[str] = Field(default=None, max_length=100)
    flgativotrabajador: Optional[bool] = None


@router.get("/trabajadores")
def list_trabajadores():
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.*, c.nbrcategoria AS categoria_nombre
              FROM construccion.m_trabajador t
              LEFT JOIN construccion.m_categoria_trabajador c ON c.id = t.categoria_id
             ORDER BY t.nbrcompleto;
            """
        )
        return [dict(r) for r in cur.fetchall()]


@router.post("/trabajadores", status_code=201)
def create_trabajador(payload: TrabajadorCreate):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO construccion.m_trabajador
                (nbrcompleto, numidentificacion, categoria_id, descategoriatrabajador,
                 desestadotrabajador, flgativotrabajador)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *;
            """,
            (
                payload.nbrcompleto.strip().upper(),
                payload.numidentificacion,
                str(payload.categoria_id) if payload.categoria_id else None,
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
    if "categoria_id" in data and data["categoria_id"] is not None:
        data["categoria_id"] = str(data["categoria_id"])
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
    """Soft-delete: mantiene FK con actividades históricas."""
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
    """Soft-delete: desactiva."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute("UPDATE auth.users SET is_active = false WHERE id = %s;", (str(user_id),))
        if cur.rowcount == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")


# ============================================================
# Catálogos maestros — CRUD genérico DRY
# ============================================================

class AreaCreate(BaseModel):
    codarea: str = Field(..., min_length=1, max_length=30)
    nbrarea: str = Field(..., min_length=1, max_length=255)
    proyecto_id: UUID  # obligatorio: cada área pertenece a un proyecto
    flgactivoarea: bool = True


class AreaUpdate(BaseModel):
    codarea: Optional[str] = Field(default=None, min_length=1, max_length=30)
    nbrarea: Optional[str] = Field(default=None, min_length=1, max_length=255)
    proyecto_id: Optional[UUID] = None  # se puede mover un área a otro proyecto
    flgactivoarea: Optional[bool] = None


class EspecialidadCreate(BaseModel):
    codespecialidad: str = Field(..., min_length=1, max_length=10)
    nbrespecialidad: str = Field(..., min_length=1, max_length=255)
    area_id: UUID
    flgactivoespecialidad: bool = True


class EspecialidadUpdate(BaseModel):
    codespecialidad: Optional[str] = Field(default=None, min_length=1, max_length=10)
    nbrespecialidad: Optional[str] = Field(default=None, min_length=1, max_length=255)
    area_id: Optional[UUID] = None
    flgactivoespecialidad: Optional[bool] = None


class CentroCostoCreate(BaseModel):
    codcentrocosto: str = Field(..., min_length=1, max_length=10)
    nbrcentrocosto: str = Field(..., min_length=1, max_length=255)
    especialidad_id: UUID
    codigo_ceco: Optional[str] = Field(default=None, max_length=50)
    tipocentrocosto: Optional[str] = Field(default=None, max_length=50)
    flgactivocentrocosto: bool = True


class CentroCostoUpdate(BaseModel):
    codcentrocosto: Optional[str] = Field(default=None, min_length=1, max_length=10)
    nbrcentrocosto: Optional[str] = Field(default=None, min_length=1, max_length=255)
    especialidad_id: Optional[UUID] = None
    codigo_ceco: Optional[str] = Field(default=None, max_length=50)
    tipocentrocosto: Optional[str] = Field(default=None, max_length=50)
    flgactivocentrocosto: Optional[bool] = None


class ProyectoCreate(BaseModel):
    codproyecto: int
    descontratoproyecto: Optional[str] = Field(default=None, max_length=100)
    nbrproyecto: Optional[str] = Field(default=None, max_length=255)
    cliproyecto: Optional[str] = Field(default=None, max_length=255)
    desproyecto: Optional[str] = None
    flgactivoproyecto: bool = True


class ProyectoUpdate(BaseModel):
    codproyecto: Optional[int] = None
    descontratoproyecto: Optional[str] = Field(default=None, max_length=100)
    nbrproyecto: Optional[str] = Field(default=None, max_length=255)
    cliproyecto: Optional[str] = Field(default=None, max_length=255)
    desproyecto: Optional[str] = None
    flgactivoproyecto: Optional[bool] = None


class CategoriaCreate(BaseModel):
    codcategoria: str = Field(..., min_length=1, max_length=30)
    nbrcategoria: str = Field(..., min_length=1, max_length=120)
    flgactivocategoria: bool = True


class CategoriaUpdate(BaseModel):
    codcategoria: Optional[str] = Field(default=None, min_length=1, max_length=30)
    nbrcategoria: Optional[str] = Field(default=None, min_length=1, max_length=120)
    flgactivocategoria: Optional[bool] = None


# ---------- helper genérico ----------
def _crud_list(table: str, order_by: str) -> list:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT * FROM {table} ORDER BY {order_by};")
        return [dict(r) for r in cur.fetchall()]


def _crud_insert(table: str, data: dict) -> dict:
    cols = ", ".join(data.keys())
    ph = ", ".join(["%s"] * len(data))
    values = tuple(str(v) if hasattr(v, 'hex') else v for v in data.values())
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(f"INSERT INTO {table} ({cols}) VALUES ({ph}) RETURNING *;", values)
        return dict(cur.fetchone())


def _crud_update(table: str, id_: UUID, data: dict) -> dict:
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin cambios")
    for k, v in list(data.items()):
        if hasattr(v, 'hex'):  # UUID
            data[k] = str(v)
    sets = ", ".join(f"{k} = %s" for k in data)
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            f"UPDATE {table} SET {sets} WHERE id = %s RETURNING *;",
            (*data.values(), str(id_)),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro no encontrado")
        return dict(row)


def _crud_soft_delete(table: str, id_: UUID, flag_col: str) -> None:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(f"UPDATE {table} SET {flag_col} = false WHERE id = %s;", (str(id_),))
        if cur.rowcount == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro no encontrado")


def _crud_reorder(table: str, ids: List[UUID]) -> None:
    """Aplica sort_order = posición+1 a la lista de IDs recibida.
    Los IDs no incluidos quedan con su sort_order actual (útil para reordenar
    sólo una página o una selección)."""
    if not ids:
        return
    with get_db() as conn, conn.cursor() as cur:
        # Update en una sola query usando UNNEST — barato y atómico.
        cur.execute(
            f"""
            UPDATE {table} AS t
               SET sort_order = v.rn
              FROM (
                  SELECT id::uuid, rn::int
                    FROM UNNEST(%s::uuid[], %s::int[]) AS x(id, rn)
              ) AS v
             WHERE t.id = v.id;
            """,
            ([str(i) for i in ids], list(range(1, len(ids) + 1))),
        )


class ReorderPayload(BaseModel):
    ids: List[UUID] = Field(..., min_length=1, max_length=500)


# ---------- Áreas ----------

@router.get("/areas")
def list_areas(proyecto_id: Optional[UUID] = Query(default=None, description="Filtrar por proyecto")):
    """Lista de áreas. Si `proyecto_id` viene, filtra sólo las del proyecto.
    Sin filtro devuelve todas (útil para admin viendo el total global)."""
    with get_db() as conn, conn.cursor() as cur:
        if proyecto_id:
            cur.execute(
                """
                SELECT a.*, p.nbrproyecto AS proyecto_nombre,
                       p.descontratoproyecto AS proyecto_contrato
                  FROM construccion.m_area a
                  LEFT JOIN construccion.m_proyecto p ON p.id = a.proyecto_id
                 WHERE a.proyecto_id = %s
                 ORDER BY a.sort_order, a.codarea;
                """,
                (str(proyecto_id),),
            )
        else:
            cur.execute(
                """
                SELECT a.*, p.nbrproyecto AS proyecto_nombre,
                       p.descontratoproyecto AS proyecto_contrato
                  FROM construccion.m_area a
                  LEFT JOIN construccion.m_proyecto p ON p.id = a.proyecto_id
                 ORDER BY a.sort_order, a.codarea;
                """
            )
        return [dict(r) for r in cur.fetchall()]


@router.post("/areas", status_code=201)
def create_area(payload: AreaCreate):
    # Validación explícita: el código debe ser único dentro del proyecto.
    # La constraint UNIQUE(proyecto_id, codarea) del DB también lo garantiza,
    # pero devolvemos un error legible antes que un IntegrityError crudo.
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM construccion.m_area WHERE proyecto_id = %s AND codarea = %s;",
            (str(payload.proyecto_id), payload.codarea),
        )
        if cur.fetchone():
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Ya existe un área con código '{payload.codarea}' en este proyecto",
            )
    return _crud_insert("construccion.m_area", payload.model_dump())


@router.patch("/areas/{area_id}")
def update_area(area_id: UUID, payload: AreaUpdate):
    return _crud_update("construccion.m_area", area_id, payload.model_dump(exclude_none=True))


@router.delete("/areas/{area_id}", status_code=204)
def delete_area(area_id: UUID):
    _crud_soft_delete("construccion.m_area", area_id, "flgactivoarea")


@router.post("/areas/reorder", status_code=204)
def reorder_areas(payload: ReorderPayload):
    _crud_reorder("construccion.m_area", payload.ids)


# ---------- Especialidades ----------

@router.get("/especialidades")
def list_especialidades(proyecto_id: Optional[UUID] = Query(default=None)):
    """Especialidades — con filtro opcional por proyecto (hereda de área)."""
    with get_db() as conn, conn.cursor() as cur:
        if proyecto_id:
            cur.execute(
                """
                SELECT e.*, a.nbrarea AS area_nombre, a.proyecto_id
                  FROM construccion.m_especialidad e
                  LEFT JOIN construccion.m_area a ON a.id = e.area_id
                 WHERE a.proyecto_id = %s
                 ORDER BY e.sort_order, a.nbrarea, e.codespecialidad;
                """,
                (str(proyecto_id),),
            )
        else:
            cur.execute(
                """
                SELECT e.*, a.nbrarea AS area_nombre, a.proyecto_id
                  FROM construccion.m_especialidad e
                  LEFT JOIN construccion.m_area a ON a.id = e.area_id
                 ORDER BY e.sort_order, a.nbrarea, e.codespecialidad;
                """
            )
        return [dict(r) for r in cur.fetchall()]


@router.post("/especialidades", status_code=201)
def create_especialidad(payload: EspecialidadCreate):
    return _crud_insert("construccion.m_especialidad", payload.model_dump())


@router.patch("/especialidades/{esp_id}")
def update_especialidad(esp_id: UUID, payload: EspecialidadUpdate):
    return _crud_update("construccion.m_especialidad", esp_id, payload.model_dump(exclude_none=True))


@router.delete("/especialidades/{esp_id}", status_code=204)
def delete_especialidad(esp_id: UUID):
    _crud_soft_delete("construccion.m_especialidad", esp_id, "flgactivoespecialidad")


@router.post("/especialidades/reorder", status_code=204)
def reorder_especialidades(payload: ReorderPayload):
    _crud_reorder("construccion.m_especialidad", payload.ids)


# ---------- Centros de costo ----------

@router.get("/centros-costo")
def list_centros_costo(proyecto_id: Optional[UUID] = Query(default=None)):
    """Centros de costo — con filtro opcional por proyecto (hereda de esp → área)."""
    with get_db() as conn, conn.cursor() as cur:
        if proyecto_id:
            cur.execute(
                """
                SELECT cc.*, e.nbrespecialidad AS especialidad_nombre,
                       a.nbrarea AS area_nombre, a.proyecto_id
                  FROM construccion.m_centrocosto cc
                  LEFT JOIN construccion.m_especialidad e ON e.id = cc.especialidad_id
                  LEFT JOIN construccion.m_area a ON a.id = e.area_id
                 WHERE a.proyecto_id = %s
                 ORDER BY cc.sort_order, a.nbrarea, e.nbrespecialidad, cc.codcentrocosto;
                """,
                (str(proyecto_id),),
            )
        else:
            cur.execute(
                """
                SELECT cc.*, e.nbrespecialidad AS especialidad_nombre,
                       a.nbrarea AS area_nombre, a.proyecto_id
                  FROM construccion.m_centrocosto cc
                  LEFT JOIN construccion.m_especialidad e ON e.id = cc.especialidad_id
                  LEFT JOIN construccion.m_area a ON a.id = e.area_id
                 ORDER BY cc.sort_order, a.nbrarea, e.nbrespecialidad, cc.codcentrocosto;
                """
            )
        return [dict(r) for r in cur.fetchall()]


@router.post("/centros-costo", status_code=201)
def create_centro_costo(payload: CentroCostoCreate):
    return _crud_insert("construccion.m_centrocosto", payload.model_dump())


@router.patch("/centros-costo/{cc_id}")
def update_centro_costo(cc_id: UUID, payload: CentroCostoUpdate):
    return _crud_update("construccion.m_centrocosto", cc_id, payload.model_dump(exclude_none=True))


@router.delete("/centros-costo/{cc_id}", status_code=204)
def delete_centro_costo(cc_id: UUID):
    _crud_soft_delete("construccion.m_centrocosto", cc_id, "flgactivocentrocosto")


@router.post("/centros-costo/reorder", status_code=204)
def reorder_centros_costo(payload: ReorderPayload):
    _crud_reorder("construccion.m_centrocosto", payload.ids)


# ---------- Proyectos ----------

@router.get("/proyectos")
def list_proyectos():
    return _crud_list("construccion.m_proyecto", "sort_order, codproyecto")


def _check_codproyecto_unique(codproyecto: int, exclude_id: Optional[UUID] = None) -> None:
    """Rechaza temprano con 409 si el código ya existe en otro proyecto.
    El UNIQUE INDEX en DB (V013) es el safety net final."""
    with get_db() as conn, conn.cursor() as cur:
        if exclude_id:
            cur.execute(
                "SELECT descontratoproyecto FROM construccion.m_proyecto"
                " WHERE codproyecto = %s AND id <> %s LIMIT 1;",
                (codproyecto, str(exclude_id)),
            )
        else:
            cur.execute(
                "SELECT descontratoproyecto FROM construccion.m_proyecto"
                " WHERE codproyecto = %s LIMIT 1;",
                (codproyecto,),
            )
        existing = cur.fetchone()
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"El código {codproyecto} ya está usado por el proyecto "
            f"'{existing['descontratoproyecto'] or '(sin contrato)'}'. "
            f"Elige otro código.",
        )


@router.post("/proyectos", status_code=201)
def create_proyecto(payload: ProyectoCreate):
    _check_codproyecto_unique(payload.codproyecto)
    try:
        return _crud_insert("construccion.m_proyecto", payload.model_dump())
    except UniqueViolation:
        # Safety net contra race condition (dos admins creando simultáneo).
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"El código {payload.codproyecto} fue tomado por otro usuario "
            f"al mismo tiempo. Elige otro código.",
        )


@router.patch("/proyectos/{proy_id}")
def update_proyecto(proy_id: UUID, payload: ProyectoUpdate):
    data = payload.model_dump(exclude_none=True)
    if "codproyecto" in data:
        _check_codproyecto_unique(data["codproyecto"], exclude_id=proy_id)
    try:
        return _crud_update("construccion.m_proyecto", proy_id, data)
    except UniqueViolation:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"El código {data.get('codproyecto')} fue tomado por otro usuario "
            f"al mismo tiempo. Elige otro código.",
        )


@router.delete("/proyectos/{proy_id}", status_code=204)
def delete_proyecto(proy_id: UUID):
    _crud_soft_delete("construccion.m_proyecto", proy_id, "flgactivoproyecto")


@router.post("/proyectos/reorder", status_code=204)
def reorder_proyectos(payload: ReorderPayload):
    _crud_reorder("construccion.m_proyecto", payload.ids)


# ---------- Categorías de trabajador ----------

@router.get("/categorias")
def list_categorias():
    return _crud_list("construccion.m_categoria_trabajador", "sort_order, codcategoria")


@router.post("/categorias", status_code=201)
def create_categoria(payload: CategoriaCreate):
    return _crud_insert("construccion.m_categoria_trabajador", payload.model_dump())


@router.patch("/categorias/{cat_id}")
def update_categoria(cat_id: UUID, payload: CategoriaUpdate):
    return _crud_update("construccion.m_categoria_trabajador", cat_id, payload.model_dump(exclude_none=True))


@router.delete("/categorias/{cat_id}", status_code=204)
def delete_categoria(cat_id: UUID):
    _crud_soft_delete("construccion.m_categoria_trabajador", cat_id, "flgactivocategoria")


@router.post("/categorias/reorder", status_code=204)
def reorder_categorias(payload: ReorderPayload):
    _crud_reorder("construccion.m_categoria_trabajador", payload.ids)


# ============================================================
# Importador Excel — jerarquía Área > Especialidad > CC por proyecto
# ============================================================

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


@router.get("/proyectos/ceco-template")
def download_ceco_template():
    """Descarga un Excel template con headers correctos + 6 filas de ejemplo
    + hoja de instrucciones. El usuario lo baja, lo llena, y lo sube.
    """
    xlsx_bytes = build_template_xlsx()
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="template_cecos_azoramind.xlsx"',
        },
    )


@router.get("/proyectos/{proyecto_id}/export-cecos")
def export_ceco_snapshot(proyecto_id: UUID):
    """Descarga la jerarquía Área/Especialidad/CC ACTUAL del proyecto como
    Excel, en el mismo formato que el template. Sirve para:
      - Respaldo (si perdés el Excel original)
      - Editar offline y re-importar (idempotente, actualiza por código)
      - Auditar el estado de la configuración
    """
    xlsx_bytes = build_snapshot_xlsx(proyecto_id)
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="cecos_proyecto_{proyecto_id}.xlsx"',
        },
    )


@router.post("/proyectos/{proyecto_id}/preview-cecos")
async def preview_import_cecos(proyecto_id: UUID, archivo: UploadFile = File(...)):
    """Valida el Excel y devuelve preview sin escribir en DB.
    Usado por la UI antes de confirmar la importación."""
    contents = await archivo.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Archivo demasiado grande (máx {MAX_UPLOAD_BYTES // 1024 // 1024} MB)"
        )
    parsed = parse_ceco_workbook(contents)
    # Sample: primeras 8 filas para mostrar al usuario
    sample = parsed["rows"][:8]
    return {
        "sheet_name": parsed["sheet_name"],
        "total_rows": len(parsed["rows"]),
        "warnings": parsed["warnings"][:20],  # limit
        "sample": sample,
        "will_touch": {
            "areas_unicas": len({r["cod01"] for r in parsed["rows"]}),
            "especialidades_unicas": len({(r["cod01"], r["cod02"]) for r in parsed["rows"]}),
            "centros_costo_unicos": len({(r["cod01"], r["cod02"], r["cod03"]) for r in parsed["rows"]}),
        },
    }


@router.post("/proyectos/{proyecto_id}/importar-cecos")
async def importar_cecos(proyecto_id: UUID, archivo: UploadFile = File(...)):
    """Importa la jerarquía completa (áreas + especialidades + CC) al proyecto.
    Idempotente: upsertea por códigos. Retorna resumen con contadores."""
    contents = await archivo.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Archivo demasiado grande (máx {MAX_UPLOAD_BYTES // 1024 // 1024} MB)"
        )
    parsed = parse_ceco_workbook(contents)
    if not parsed["rows"]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "El Excel no tiene filas válidas para importar"
        )
    result = import_to_proyecto(proyecto_id, parsed)
    return result
