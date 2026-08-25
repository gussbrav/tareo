"""DTOs de actividades."""
from datetime import date, datetime, time
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

EstadoActividad = Literal["iniciado", "finalizado"]


class ActividadCreateBulk(BaseModel):
    """Crear N actividades en un solo POST (una por trabajador)."""

    fecactividad: date
    proyecto_id: UUID
    centro_costo_id: UUID
    desactividad: str = Field(..., min_length=1, max_length=2000)
    trabajador_ids: List[UUID] = Field(..., min_length=1, max_length=100)

    @field_validator("desactividad")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class ActividadUpdate(BaseModel):
    """Editar una actividad existente. Todos los campos opcionales."""

    desactividad: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    horinicio: Optional[time] = None
    horfin: Optional[time] = None
    desestadoactividad: Optional[EstadoActividad] = None
    desobservaciones: Optional[str] = Field(default=None, max_length=2000)


class ActividadListItem(BaseModel):
    id: UUID
    fecactividad: date
    fecdia_display: str
    trabajador_id: UUID
    trabajador_nombre: str
    desactividad: Optional[str] = None
    horinicio: Optional[time] = None
    horfin: Optional[time] = None
    desestadoactividad: EstadoActividad
    detalle_resumido: str
    centro_costo_nombre: Optional[str] = None
    proyecto_nombre: Optional[str] = None
    numduracionminuto: Optional[int] = None


class ActividadDetalle(BaseModel):
    id: UUID
    fecactividad: date
    trabajador_id: UUID
    trabajador_nombre: str
    desactividad: Optional[str] = None
    horinicio: Optional[time] = None
    horfin: Optional[time] = None
    desestadoactividad: EstadoActividad
    desobservaciones: Optional[str] = None
    centro_costo_id: UUID
    centro_costo_nombre: Optional[str] = None
    proyecto_id: UUID
    proyecto_nombre: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class BulkFinalizeRequest(BaseModel):
    ids: List[UUID] = Field(..., min_length=1, max_length=200)


class BulkResult(BaseModel):
    updated: int
    requested: int
