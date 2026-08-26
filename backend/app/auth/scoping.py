"""Scoping helpers — a qué proyectos tiene acceso un usuario.

Modelo:
- Admin: acceso a TODOS los proyectos por su rol. Bypass a nivel aplicación.
- Supervisor / trabajador: ven solo los proyectos listados en `auth.user_proyecto`.

Uso típico en un endpoint:

    from app.auth.scoping import get_accessible_proyecto_ids

    def mi_endpoint(user = Depends(get_current_user)):
        scoped = get_accessible_proyecto_ids(user)
        if scoped is None:
            # admin — no filter, pasa None a la query
            ...
        else:
            # supervisor/trabajador — filtrar por el set. Si vacío, devolver []
            ...

El helper `filter_ids_or_none` es azúcar: reduce la lógica del caller.
"""
from typing import List, Optional
from uuid import UUID

from app.auth.schemas import UserPublic
from app.database import get_db


def get_accessible_proyecto_ids(user: UserPublic) -> Optional[List[str]]:
    """Retorna la lista de proyecto UUIDs (como str) accesibles por el user.

    Convención:
    - `None` = admin (sin filtro, ve todo).
    - `[]`   = supervisor/trabajador sin proyectos asignados (no ve nada).
    - `[...]` = lista concreta a usar como filter WHERE proyecto_id = ANY(%s).
    """
    if user.role == "admin":
        return None
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT proyecto_id FROM auth.user_proyecto WHERE user_id = %s;",
            (str(user.id),),
        )
        return [str(r["proyecto_id"]) for r in cur.fetchall()]


def assert_can_access_proyecto(user: UserPublic, proyecto_id: UUID) -> None:
    """Lanza HTTP 403 si el usuario no tiene acceso al proyecto."""
    from fastapi import HTTPException, status

    scoped = get_accessible_proyecto_ids(user)
    if scoped is None:
        return  # admin
    if str(proyecto_id) not in scoped:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "No tienes acceso a este proyecto",
        )
