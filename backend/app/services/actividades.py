"""Lógica de negocio de actividades: reglas, validaciones, orquestación."""
from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.auth.schemas import UserPublic
from app.repositories import actividades as repo
from app.schemas.actividades import (
    ActividadCreateBulk,
    ActividadUpdate,
    BulkResult,
)


def create_bulk(payload: ActividadCreateBulk, user: UserPublic) -> Dict[str, Any]:
    """Crea N actividades para los trabajadores seleccionados.

    Regla: solo admin y supervisor pueden crear actividades (los trabajadores
    ven las suyas pero no crean).
    """
    if user.role not in ("admin", "supervisor"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Rol no autorizado para crear actividades")

    if not payload.trabajador_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Selecciona al menos un trabajador")

    # Dedup: por si el frontend manda el mismo id dos veces.
    unique_ids = list({tid for tid in payload.trabajador_ids})

    inserted = repo.insert_bulk(
        trabajador_ids=unique_ids,
        fecactividad=payload.fecactividad,
        proyecto_id=payload.proyecto_id,
        centro_costo_id=payload.centro_costo_id,
        desactividad=payload.desactividad,
        created_by=user.id,
    )
    return {"created": inserted, "requested": len(unique_ids)}


def list_for_user(
    fecha: date,
    user: UserPublic,
    q: Optional[str] = None,
    page: int = 1,
    size: int = 50,
) -> Dict[str, Any]:
    """Reglas de visibilidad:

    - admin y supervisor: ven todas las actividades del día.
    - trabajador: ve solo las suyas (según user.trabajador_id).

    Devuelve dict paginado {items, total, page, size, pages} — forma consistente
    para cualquier rol (permite un mismo cliente sin ramas por role).
    """
    if user.role == "trabajador":
        if not user.trabajador_id:
            # Trabajador sin trabajador_id linkeado: no ve nada. Evita filtrar por None.
            return {"items": [], "total": 0, "page": page, "size": size, "pages": 0}
        items, total = repo.list_by_trabajador(user.trabajador_id, fecha, q=q, page=page, size=size)
    else:
        items, total = repo.list_by_date(fecha, q=q, page=page, size=size)
    pages = (total + size - 1) // size if total else 0
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}


def list_month_for_user(
    year: int,
    month: int,
    user: UserPublic,
    trabajador_id: Optional[UUID] = None,
    proyecto_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """Vista agenda: todas las actividades del mes con filtros opcionales.
    Trabajador siempre ve sólo las suyas (ignora filtro trabajador_id)."""
    if user.role == "trabajador":
        if not user.trabajador_id:
            return {"actividades": []}
        actividades = repo.list_by_month(
            year=year, month=month,
            trabajador_id=user.trabajador_id,
            proyecto_id=proyecto_id,
        )
    else:
        actividades = repo.list_by_month(
            year=year, month=month,
            trabajador_id=trabajador_id,
            proyecto_id=proyecto_id,
        )
    return {"actividades": actividades}


def get_detail(actividad_id: UUID, user: UserPublic) -> Dict[str, Any]:
    row = repo.get_by_id(actividad_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Actividad no encontrada")
    if user.role == "trabajador" and row["trabajador_id"] != user.trabajador_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes acceso a esta actividad")
    return row


def update(actividad_id: UUID, payload: ActividadUpdate, user: UserPublic) -> Dict[str, Any]:
    """Solo admin puede editar libremente. Supervisor puede editar sus creados.
    Trabajador puede solo cambiar observaciones (subset limitado).
    """
    existing = repo.get_by_id(actividad_id)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Actividad no encontrada")

    if user.role == "trabajador":
        if existing["trabajador_id"] != user.trabajador_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a esta actividad")
        # Trabajador: solo puede editar observaciones y finalizar.
        allowed = {"desobservaciones", "desestadoactividad", "horfin"}
        payload_data = payload.model_dump(exclude_none=True)
        forbidden = set(payload_data.keys()) - allowed
        if forbidden:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Trabajador no puede modificar: {', '.join(sorted(forbidden))}",
            )
    # admin y supervisor: pueden todo.

    repo.update(
        actividad_id=actividad_id,
        updated_by=user.id,
        desactividad=payload.desactividad,
        horinicio=payload.horinicio,
        horfin=payload.horfin,
        desestadoactividad=payload.desestadoactividad,
        desobservaciones=payload.desobservaciones,
    )
    updated = repo.get_by_id(actividad_id)
    return updated


def delete(actividad_id: UUID, user: UserPublic) -> None:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo admin puede eliminar actividades")
    if repo.delete(actividad_id) == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Actividad no encontrada")


def finalize_batch(ids: List[UUID], user: UserPublic) -> BulkResult:
    if user.role == "trabajador":
        # Trabajador solo puede finalizar las suyas — filtrar antes de llamar función SQL.
        own_ids: List[UUID] = []
        for aid in ids:
            row = repo.get_by_id(aid)
            if row and row["trabajador_id"] == user.trabajador_id:
                own_ids.append(aid)
        if not own_ids:
            return BulkResult(updated=0, requested=len(ids))
        result = repo.finalize_batch(own_ids)
    else:
        result = repo.finalize_batch(ids)
    return BulkResult(**result)


def finalize_one(actividad_id: UUID, user: UserPublic) -> BulkResult:
    row = repo.get_by_id(actividad_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Actividad no encontrada")
    if user.role == "trabajador" and row["trabajador_id"] != user.trabajador_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a esta actividad")
    result = repo.finalize_one(actividad_id)
    return BulkResult(**result)
