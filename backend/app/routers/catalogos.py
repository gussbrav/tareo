"""Endpoints de catálogos maestros (read-only para todos los roles autenticados).

Todos los endpoints aplican scoping por proyecto — un supervisor solo ve
lo que hay en sus proyectos asignados. Admin bypassa (ve todo).
"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserPublic
from app.auth.scoping import assert_can_access_proyecto, get_accessible_proyecto_ids
from app.repositories import catalogos as repo

router = APIRouter(prefix="/api/catalogos", tags=["catalogos"])


@router.get("/areas", response_model=List[dict])
def get_areas(
    proyecto_id: Optional[UUID] = Query(default=None, description="Filtrar por proyecto"),
    user: UserPublic = Depends(get_current_user),
):
    # Si viene proyecto_id, verificar que el user tenga acceso.
    if proyecto_id:
        assert_can_access_proyecto(user, proyecto_id)
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
def get_proyectos(user: UserPublic = Depends(get_current_user)):
    """Solo devuelve los proyectos accesibles por el user. Admin ve todos."""
    scoped = get_accessible_proyecto_ids(user)
    return repo.list_proyectos(proyecto_ids=scoped)


@router.get("/trabajadores", response_model=List[dict])
def get_trabajadores_disponibles(
    fecha: date = Query(..., description="Fecha de la actividad (YYYY-MM-DD)"),
    proyecto_id: Optional[UUID] = Query(
        default=None,
        description="Proyecto al que se asignará la actividad. Si se omite, devuelve unión de trabajadores de todos los proyectos accesibles al user.",
    ),
    user: UserPublic = Depends(get_current_user),
):
    """Trabajadores libres esa fecha (sin actividad 'iniciado').

    Comportamiento según parámetros y rol:
    - proyecto_id + user con acceso → devuelve trabajadores de ese proyecto
    - sin proyecto_id + admin → devuelve todos los trabajadores activos
    - sin proyecto_id + supervisor/trabajador → devuelve unión de sus proyectos

    Mantiene proyecto_id opcional para compat con clientes viejos (APK previa
    al scoping). El web SIEMPRE pasa proyecto_id.
    """
    if proyecto_id:
        assert_can_access_proyecto(user, proyecto_id)
        return repo.list_trabajadores_disponibles(fecha, proyecto_id=proyecto_id)
    scope = get_accessible_proyecto_ids(user)
    if scope is not None and not scope:
        return []
    return repo.list_trabajadores_disponibles_union(fecha, proyecto_ids=scope)


@router.get("/trabajadores/all", response_model=List[dict])
def get_trabajadores_all(_: UserPublic = Depends(get_current_user)):
    """Lista completa (para admin/reportes)."""
    return repo.list_trabajadores_all()
