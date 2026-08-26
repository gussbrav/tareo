"""Endpoints de actividades (tareo)."""
from datetime import date
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserPublic
from app.schemas.actividades import (
    ActividadCreateBulk,
    ActividadDetalle,
    ActividadListItem,
    ActividadUpdate,
    BulkFinalizeRequest,
    BulkResult,
)
from app.services import actividades as svc

router = APIRouter(prefix="/api/actividades", tags=["actividades"])


@router.post("", status_code=201)
def crear_bulk(payload: ActividadCreateBulk, user: UserPublic = Depends(get_current_user)) -> dict:
    return svc.create_bulk(payload, user)


@router.get("", response_model=List[ActividadListItem])
def listar(
    fecha: date = Query(..., description="Fecha del tareo (YYYY-MM-DD)"),
    user: UserPublic = Depends(get_current_user),
):
    return svc.list_for_user(fecha, user)


@router.get("/mes")
def listar_mes(
    mes: str = Query(..., pattern=r"^\d{4}-\d{2}$", description="Mes YYYY-MM"),
    trabajador_id: UUID | None = Query(default=None),
    proyecto_id: UUID | None = Query(default=None),
    user: UserPublic = Depends(get_current_user),
):
    """Vista agenda: actividades del mes completo con filtros opcionales.
    Payload optimizado para renderizar pills en grilla mensual."""
    year, month = mes.split("-")
    return svc.list_month_for_user(
        year=int(year), month=int(month), user=user,
        trabajador_id=trabajador_id, proyecto_id=proyecto_id,
    )


@router.get("/{actividad_id}", response_model=ActividadDetalle)
def detalle(actividad_id: UUID, user: UserPublic = Depends(get_current_user)):
    return svc.get_detail(actividad_id, user)


@router.patch("/{actividad_id}", response_model=ActividadDetalle)
def editar(
    actividad_id: UUID,
    payload: ActividadUpdate,
    user: UserPublic = Depends(get_current_user),
):
    return svc.update(actividad_id, payload, user)


@router.delete("/{actividad_id}", status_code=204)
def eliminar(actividad_id: UUID, user: UserPublic = Depends(get_current_user)) -> None:
    svc.delete(actividad_id, user)


@router.post("/{actividad_id}/finalizar", response_model=BulkResult)
def finalizar_individual(actividad_id: UUID, user: UserPublic = Depends(get_current_user)) -> BulkResult:
    return svc.finalize_one(actividad_id, user)


@router.post("/finalizar-batch", response_model=BulkResult)
def finalizar_batch(
    payload: BulkFinalizeRequest,
    user: UserPublic = Depends(get_current_user),
) -> BulkResult:
    return svc.finalize_batch(payload.ids, user)
