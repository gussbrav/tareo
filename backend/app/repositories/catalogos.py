"""SQL de catálogos maestros. Cero lógica de negocio."""
from datetime import date
from typing import List, Optional
from uuid import UUID

from app.database import get_db


def list_areas(proyecto_id: Optional[UUID] = None) -> List[dict]:
    """Áreas activas. Si `proyecto_id` viene, sólo las del proyecto."""
    with get_db() as conn, conn.cursor() as cur:
        if proyecto_id:
            cur.execute(
                """
                SELECT id, codarea, nbrarea, proyecto_id,
                       CONCAT(codarea, ' - ', nbrarea) AS display_name
                  FROM construccion.m_area
                 WHERE flgactivoarea = true AND proyecto_id = %s
                 ORDER BY sort_order, codarea;
                """,
                (str(proyecto_id),),
            )
        else:
            cur.execute(
                """
                SELECT id, codarea, nbrarea, proyecto_id,
                       CONCAT(codarea, ' - ', nbrarea) AS display_name
                  FROM construccion.m_area
                 WHERE flgactivoarea = true
                 ORDER BY sort_order, codarea;
                """
            )
        return [dict(r) for r in cur.fetchall()]


def list_especialidades(area_id: UUID) -> List[dict]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, codespecialidad, nbrespecialidad,
                   CONCAT(codespecialidad, ' - ', nbrespecialidad) AS display_name
              FROM construccion.m_especialidad
             WHERE area_id = %s AND flgactivoespecialidad = true
             ORDER BY codespecialidad;
            """,
            (str(area_id),),
        )
        return [dict(r) for r in cur.fetchall()]


def list_centros_costo(especialidad_id: UUID) -> List[dict]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, codcentrocosto, nbrcentrocosto, codigo_ceco,
                   CONCAT(codcentrocosto, ' - ', nbrcentrocosto) AS display_name
              FROM construccion.m_centrocosto
             WHERE especialidad_id = %s AND flgactivocentrocosto = true
             ORDER BY codcentrocosto;
            """,
            (str(especialidad_id),),
        )
        return [dict(r) for r in cur.fetchall()]


def list_proyectos(proyecto_ids: Optional[List[str]] = None) -> List[dict]:
    """Proyectos activos. Si `proyecto_ids` es una lista, filtra por ese set
    (scoping por usuario). None = sin filtro (admin bypass)."""
    if proyecto_ids is not None and not proyecto_ids:
        return []  # user sin proyectos asignados → lista vacía
    with get_db() as conn, conn.cursor() as cur:
        if proyecto_ids is None:
            cur.execute(
                """
                SELECT id, codproyecto, nbrproyecto, descontratoproyecto
                  FROM construccion.m_proyecto
                 WHERE flgactivoproyecto = true
                 ORDER BY codproyecto;
                """
            )
        else:
            cur.execute(
                """
                SELECT id, codproyecto, nbrproyecto, descontratoproyecto
                  FROM construccion.m_proyecto
                 WHERE flgactivoproyecto = true
                   AND id = ANY(%s::uuid[])
                 ORDER BY codproyecto;
                """,
                (proyecto_ids,),
            )
        return [dict(r) for r in cur.fetchall()]


def list_trabajadores_disponibles(fecha: date, proyecto_id: UUID) -> List[dict]:
    """Trabajadores del PROYECTO activos que NO tengan actividad 'iniciado' esa fecha.

    Aplica scoping por proyecto (V014): solo devuelve trabajadores asignados
    al proyecto vía construccion.trabajador_proyecto. Cambio breaking:
    proyecto_id ahora es obligatorio — el frontend fue actualizado.
    """
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.id,
                   t.nbrcompleto,
                   t.numidentificacion,
                   t.descategoriatrabajador,
                   CONCAT(t.nbrcompleto, ' - ', COALESCE(t.descategoriatrabajador, '')) AS display_name
              FROM construccion.m_trabajador t
              JOIN construccion.trabajador_proyecto tp
                     ON tp.trabajador_id = t.id
                    AND tp.proyecto_id = %s
              LEFT JOIN construccion.m_actividad a
                     ON a.trabajador_id = t.id
                    AND a.fecactividad = %s
                    AND a.desestadoactividad = 'iniciado'
             WHERE t.flgativotrabajador = true
               AND lower(t.desestadotrabajador) = 'activo'
               AND a.trabajador_id IS NULL
             ORDER BY t.nbrcompleto;
            """,
            (str(proyecto_id), fecha),
        )
        return [dict(r) for r in cur.fetchall()]


def list_trabajadores_disponibles_union(
    fecha: date,
    proyecto_ids: Optional[List[str]] = None,
) -> List[dict]:
    """Unión de trabajadores libres esa fecha en los proyectos accesibles.
    Fallback para clientes que no envían proyecto_id (mobile viejo, admin).

    - proyecto_ids=None (admin bypass): TODOS los trabajadores activos libres.
    - proyecto_ids=[...]: DISTINCT de trabajadores en esos proyectos.
    """
    with get_db() as conn, conn.cursor() as cur:
        if proyecto_ids is None:
            cur.execute(
                """
                SELECT t.id,
                       t.nbrcompleto,
                       t.numidentificacion,
                       t.descategoriatrabajador,
                       CONCAT(t.nbrcompleto, ' - ', COALESCE(t.descategoriatrabajador, '')) AS display_name
                  FROM construccion.m_trabajador t
                  LEFT JOIN construccion.m_actividad a
                         ON a.trabajador_id = t.id
                        AND a.fecactividad = %s
                        AND a.desestadoactividad = 'iniciado'
                 WHERE t.flgativotrabajador = true
                   AND lower(t.desestadotrabajador) = 'activo'
                   AND a.trabajador_id IS NULL
                 ORDER BY t.nbrcompleto;
                """,
                (fecha,),
            )
        else:
            cur.execute(
                """
                SELECT DISTINCT t.id,
                       t.nbrcompleto,
                       t.numidentificacion,
                       t.descategoriatrabajador,
                       CONCAT(t.nbrcompleto, ' - ', COALESCE(t.descategoriatrabajador, '')) AS display_name
                  FROM construccion.m_trabajador t
                  JOIN construccion.trabajador_proyecto tp
                         ON tp.trabajador_id = t.id
                        AND tp.proyecto_id = ANY(%s::uuid[])
                  LEFT JOIN construccion.m_actividad a
                         ON a.trabajador_id = t.id
                        AND a.fecactividad = %s
                        AND a.desestadoactividad = 'iniciado'
                 WHERE t.flgativotrabajador = true
                   AND lower(t.desestadotrabajador) = 'activo'
                   AND a.trabajador_id IS NULL
                 ORDER BY t.nbrcompleto;
                """,
                (proyecto_ids, fecha),
            )
        return [dict(r) for r in cur.fetchall()]


def list_trabajadores_all() -> List[dict]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, nbrcompleto, numidentificacion, descategoriatrabajador,
                   desestadotrabajador, flgativotrabajador
              FROM construccion.m_trabajador
             ORDER BY nbrcompleto;
            """
        )
        return [dict(r) for r in cur.fetchall()]
