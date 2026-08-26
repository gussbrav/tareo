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


def list_proyectos() -> List[dict]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, codproyecto, nbrproyecto, descontratoproyecto
              FROM construccion.m_proyecto
             WHERE flgactivoproyecto = true
             ORDER BY codproyecto;
            """
        )
        return [dict(r) for r in cur.fetchall()]


def list_trabajadores_disponibles(fecha: date) -> List[dict]:
    """Trabajadores activos que NO tengan actividad 'iniciado' esa fecha.

    Replica la regla del original: un trabajador no puede estar en 2
    actividades iniciadas al mismo día — evita doble-conteo de horas.
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
