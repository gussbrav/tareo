"""Endpoints de catálogos maestros (read-only para todos los roles autenticados)."""
from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserPublic
from app.repositories import catalogos as repo

router = APIRouter(prefix="/api/catalogos", tags=["catalogos"])


@router.get("/areas", response_model=List[dict])
def get_areas(
    proyecto_id: Optional[UUID] = Query(default=None, description="Filtrar por proyecto"),
    _: UserPublic = Depends(get_current_user),
):
    return repo.list_areas(proyecto_id=proyecto_id)


@router.get("/especialidades", response_model=List[dict])
def get_especialidades(
    area_id: UUID = Query(..., description="UUID del área padre"),
    _: UserPublic = Depends(get_current_user),
):
    return repo.list_especialidades(area_id)


@router.get("/centros-costo", response_model=List[dict])
def get_centros_costo(
    especialidad_id: UUID = Query(..., description="UUID de la especialidad padre"),
    _: UserPublic = Depends(get_current_user),
):
    return repo.list_centros_costo(especialidad_id)


@router.get("/proyectos", response_model=List[dict])
def get_proyectos(_: UserPublic = Depends(get_current_user)):
    return repo.list_proyectos()


@router.get("/trabajadores", response_model=List[dict])
def get_trabajadores_disponibles(
    fecha: date = Query(..., description="Fecha de la actividad (YYYY-MM-DD)"),
    _: UserPublic = Depends(get_current_user),
):
    """Trabajadores libres esa fecha (sin actividad 'iniciado')."""
    return repo.list_trabajadores_disponibles(fecha)


@router.get("/trabajadores/all", response_model=List[dict])
def get_trabajadores_all(_: UserPublic = Depends(get_current_user)):
    """Lista completa (para admin/reportes)."""
    return repo.list_trabajadores_all()
