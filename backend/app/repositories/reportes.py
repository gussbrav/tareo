"""Queries agregadas para dashboard/reportes."""
from datetime import date
from typing import Any, Dict, List

from app.database import get_db


def kpis_generales(desde: date, hasta: date) -> Dict[str, Any]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                COUNT(*)::int AS total_actividades,
                COUNT(*) FILTER (WHERE desestadoactividad='finalizado')::int AS finalizadas,
                COUNT(*) FILTER (WHERE desestadoactividad='iniciado')::int AS en_proceso,
                COALESCE(SUM(numduracionminuto) FILTER (WHERE desestadoactividad='finalizado'), 0)::int
                    AS minutos_totales,
                COUNT(DISTINCT trabajador_id)::int AS trabajadores_involucrados
              FROM construccion.m_actividad
             WHERE fecactividad BETWEEN %s AND %s;
            """,
            (desde, hasta),
        )
        return dict(cur.fetchone())


def horas_por_trabajador(desde: date, hasta: date) -> List[Dict[str, Any]]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.nbrcompleto AS trabajador,
                   COUNT(a.*)::int AS actividades,
                   COALESCE(SUM(a.numduracionminuto), 0)::int AS minutos,
                   ROUND(COALESCE(SUM(a.numduracionminuto), 0) / 60.0, 2)::float AS horas
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
             WHERE a.fecactividad BETWEEN %s AND %s
               AND a.desestadoactividad = 'finalizado'
             GROUP BY t.nbrcompleto
             ORDER BY horas DESC
             LIMIT 20;
            """,
            (desde, hasta),
        )
        return [dict(r) for r in cur.fetchall()]


def horas_por_semana(desde: date, hasta: date) -> List[Dict[str, Any]]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT numsemana AS semana,
                   COUNT(*)::int AS actividades,
                   ROUND(COALESCE(SUM(numduracionminuto), 0) / 60.0, 2)::float AS horas
              FROM construccion.m_actividad
             WHERE fecactividad BETWEEN %s AND %s
               AND desestadoactividad = 'finalizado'
             GROUP BY numsemana
             ORDER BY numsemana;
            """,
            (desde, hasta),
        )
        return [dict(r) for r in cur.fetchall()]


def horas_por_centro_costo(desde: date, hasta: date) -> List[Dict[str, Any]]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(cc.nbrcentrocosto, 'Sin CC') AS centro_costo,
                   COALESCE(cc.codigo_ceco, '') AS codigo,
                   COUNT(*)::int AS actividades,
                   ROUND(COALESCE(SUM(a.numduracionminuto), 0) / 60.0, 2)::float AS horas
              FROM construccion.m_actividad a
              LEFT JOIN construccion.m_centrocosto cc ON cc.id = a.centro_costo_id
             WHERE a.fecactividad BETWEEN %s AND %s
               AND a.desestadoactividad = 'finalizado'
             GROUP BY cc.nbrcentrocosto, cc.codigo_ceco
             ORDER BY horas DESC
             LIMIT 20;
            """,
            (desde, hasta),
        )
        return [dict(r) for r in cur.fetchall()]


def actividades_para_export(desde: date, hasta: date) -> List[Dict[str, Any]]:
    """Data para el Excel. Un flat con todas las columnas."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.fecactividad,
                   a.numsemana,
                   t.nbrcompleto AS trabajador,
                   t.numidentificacion AS documento,
                   t.descategoriatrabajador AS categoria,
                   a.desactividad,
                   a.horinicio::time AS hora_inicio,
                   a.horfin::time AS hora_fin,
                   a.numduracionminuto AS duracion_min,
                   a.desestadoactividad AS estado,
                   COALESCE(p.descontratoproyecto, '') AS contrato,
                   COALESCE(cc.codigo_ceco, '') AS ceco,
                   COALESCE(cc.nbrcentrocosto, '') AS centro_costo,
                   COALESCE(a.desobservaciones, '') AS observaciones
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_proyecto p ON p.id = a.proyecto_id
              LEFT JOIN construccion.m_centrocosto cc ON cc.id = a.centro_costo_id
             WHERE a.fecactividad BETWEEN %s AND %s
             ORDER BY a.fecactividad, t.nbrcompleto;
            """,
            (desde, hasta),
        )
        return [dict(r) for r in cur.fetchall()]
