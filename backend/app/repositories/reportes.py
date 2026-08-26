"""Queries agregadas para dashboard/reportes."""
from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID

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


# ─────────────────────────────────────────────
# Nuevas queries para el Dashboard v2
# ─────────────────────────────────────────────

def dashboard_completo(
    desde: date,
    hasta: date,
    proyecto_id: Optional[UUID] = None,
    area_id: Optional[UUID] = None,
    categoria_id: Optional[UUID] = None,
    proyecto_ids_scope: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Agrega en una sola conexión todos los datos del dashboard v2:
    KPIs del período + período anterior comparable, tendencia diaria,
    top trabajadores, distribución por categoría, por CC, y alertas.

    `proyecto_ids_scope`: si viene, filtra por a.proyecto_id IN (...) — usado
    para scoping por usuario (admin bypass = None).
    """
    dias = max((hasta - desde).days, 1)
    from datetime import timedelta
    desde_prev = desde - timedelta(days=dias + 1)
    hasta_prev = desde - timedelta(days=1)

    # Filtros dimensionales opcionales
    filtros_base = []
    params_filtros = []
    if proyecto_ids_scope is not None:
        filtros_base.append("a.proyecto_id = ANY(%s::uuid[])")
        params_filtros.append(proyecto_ids_scope)
    if proyecto_id:
        filtros_base.append("a.proyecto_id = %s")
        params_filtros.append(str(proyecto_id))
    if area_id:
        filtros_base.append(
            "a.centro_costo_id IN ("
            "  SELECT cc.id FROM construccion.m_centrocosto cc"
            "  JOIN construccion.m_especialidad e ON e.id = cc.especialidad_id"
            "  WHERE e.area_id = %s"
            ")"
        )
        params_filtros.append(str(area_id))
    if categoria_id:
        filtros_base.append("t.categoria_id = %s")
        params_filtros.append(str(categoria_id))

    extra_where = ""
    if filtros_base:
        extra_where = " AND " + " AND ".join(filtros_base)

    with get_db() as conn, conn.cursor() as cur:
        # ── 1. KPIs período actual ──────────────────────────────────────────
        q_kpis = f"""
            SELECT
                COUNT(*)::int                                                            AS total_actividades,
                COUNT(*) FILTER (WHERE a.desestadoactividad='finalizado')::int           AS finalizadas,
                COUNT(*) FILTER (WHERE a.desestadoactividad='iniciado')::int             AS en_proceso,
                COALESCE(SUM(a.numduracionminuto)
                         FILTER (WHERE a.desestadoactividad='finalizado'), 0)::int       AS minutos_totales,
                COUNT(DISTINCT a.trabajador_id)::int                                     AS trabajadores_activos,
                COUNT(DISTINCT a.fecactividad)::int                                      AS dias_con_actividad,
                ROUND(
                    COALESCE(SUM(a.numduracionminuto) FILTER (WHERE a.desestadoactividad='finalizado'), 0)
                    / NULLIF(COUNT(DISTINCT a.fecactividad), 0) / 60.0,
                2)::float                                                                AS horas_por_dia_promedio,
                ROUND(
                    COUNT(*) FILTER (WHERE a.desestadoactividad='finalizado') * 100.0
                    / NULLIF(COUNT(*), 0),
                1)::float                                                                AS tasa_finalizacion
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
             WHERE a.fecactividad BETWEEN %s AND %s
             {extra_where};
        """
        cur.execute(q_kpis, [desde, hasta] + params_filtros)
        kpis = dict(cur.fetchone())

        # ── 2. KPIs período anterior (delta) ───────────────────────────────
        cur.execute(q_kpis, [desde_prev, hasta_prev] + params_filtros)
        kpis_prev = dict(cur.fetchone())

        # ── 3. Tendencia diaria ────────────────────────────────────────────
        q_tendencia = f"""
            SELECT
                a.fecactividad::text                                               AS fecha,
                COUNT(*)::int                                                      AS actividades,
                COUNT(*) FILTER (WHERE a.desestadoactividad='finalizado')::int     AS finalizadas,
                ROUND(COALESCE(SUM(a.numduracionminuto)
                      FILTER (WHERE a.desestadoactividad='finalizado'), 0)
                      / 60.0, 2)::float                                            AS horas
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
             WHERE a.fecactividad BETWEEN %s AND %s
             {extra_where}
             GROUP BY a.fecactividad
             ORDER BY a.fecactividad;
        """
        cur.execute(q_tendencia, [desde, hasta] + params_filtros)
        tendencia = [dict(r) for r in cur.fetchall()]

        # ── 4. Top 10 trabajadores ─────────────────────────────────────────
        q_top = f"""
            SELECT
                t.nbrcompleto                                                     AS trabajador,
                COALESCE(cat.nbrcategoria, t.descategoriatrabajador, 'Sin cat.') AS categoria,
                COUNT(a.*)::int                                                   AS actividades,
                ROUND(COALESCE(SUM(a.numduracionminuto), 0) / 60.0, 2)::float    AS horas,
                ROUND(
                    COALESCE(SUM(a.numduracionminuto), 0) * 100.0
                    / NULLIF(
                        SUM(SUM(a.numduracionminuto)) OVER (), 0
                    ), 1
                )::float                                                          AS pct_total
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_categoria_trabajador cat ON cat.id = t.categoria_id
             WHERE a.fecactividad BETWEEN %s AND %s
               AND a.desestadoactividad = 'finalizado'
             {extra_where}
             GROUP BY t.nbrcompleto, cat.nbrcategoria, t.descategoriatrabajador
             ORDER BY horas DESC
             LIMIT 10;
        """
        cur.execute(q_top, [desde, hasta] + params_filtros)
        top_trabajadores = [dict(r) for r in cur.fetchall()]

        # ── 5. Distribución por categoría ──────────────────────────────────
        q_cat = f"""
            SELECT
                COALESCE(cat.nbrcategoria, t.descategoriatrabajador, 'Sin categoría') AS categoria,
                COUNT(a.*)::int                                                        AS actividades,
                ROUND(COALESCE(SUM(a.numduracionminuto), 0) / 60.0, 2)::float         AS horas,
                ROUND(
                    COALESCE(SUM(a.numduracionminuto), 0) * 100.0
                    / NULLIF(SUM(SUM(a.numduracionminuto)) OVER (), 0),
                1)::float                                                              AS pct_total
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_categoria_trabajador cat ON cat.id = t.categoria_id
             WHERE a.fecactividad BETWEEN %s AND %s
               AND a.desestadoactividad = 'finalizado'
             {extra_where}
             GROUP BY cat.nbrcategoria, t.descategoriatrabajador
             ORDER BY horas DESC;
        """
        cur.execute(q_cat, [desde, hasta] + params_filtros)
        por_categoria = [dict(r) for r in cur.fetchall()]

        # ── 6. Por centro de costo ─────────────────────────────────────────
        q_cc = f"""
            SELECT
                COALESCE(cc.nbrcentrocosto, 'Sin CC')                            AS centro_costo,
                COALESCE(cc.codigo_ceco, '')                                     AS codigo,
                COUNT(a.*)::int                                                  AS actividades,
                ROUND(COALESCE(SUM(a.numduracionminuto), 0) / 60.0, 2)::float   AS horas,
                ROUND(
                    COALESCE(SUM(a.numduracionminuto), 0) * 100.0
                    / NULLIF(SUM(SUM(a.numduracionminuto)) OVER (), 0),
                1)::float                                                        AS pct_total
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_centrocosto cc ON cc.id = a.centro_costo_id
             WHERE a.fecactividad BETWEEN %s AND %s
               AND a.desestadoactividad = 'finalizado'
             {extra_where}
             GROUP BY cc.nbrcentrocosto, cc.codigo_ceco
             ORDER BY horas DESC
             LIMIT 15;
        """
        cur.execute(q_cc, [desde, hasta] + params_filtros)
        por_cc = [dict(r) for r in cur.fetchall()]

        # ── 7. Heatmap: día de semana × hora del día ────────────────────────
        # Solo sobre actividades finalizadas con horinicio válido
        q_heat = f"""
            SELECT
                EXTRACT(DOW FROM a.fecactividad)::int      AS dia_semana,
                EXTRACT(HOUR FROM a.horinicio::time)::int  AS hora,
                COUNT(*)::int                              AS actividades,
                ROUND(COALESCE(SUM(a.numduracionminuto), 0) / 60.0, 2)::float AS horas
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
             WHERE a.fecactividad BETWEEN %s AND %s
               AND a.desestadoactividad = 'finalizado'
               AND a.horinicio IS NOT NULL
             {extra_where}
             GROUP BY dia_semana, hora
             ORDER BY dia_semana, hora;
        """
        cur.execute(q_heat, [desde, hasta] + params_filtros)
        heatmap = [dict(r) for r in cur.fetchall()]

        # ── 8. Alertas: actividades en riesgo (iniciado > 3 días) ──────────
        q_alertas = f"""
            SELECT
                t.nbrcompleto                                             AS trabajador,
                a.fecactividad::text                                      AS fecha,
                COALESCE(a.desactividad, 'Sin descripción')              AS actividad,
                COALESCE(cc.nbrcentrocosto, 'Sin CC')                    AS centro_costo,
                (CURRENT_DATE - a.fecactividad)::int                     AS dias_pendiente
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_centrocosto cc ON cc.id = a.centro_costo_id
             WHERE a.desestadoactividad = 'iniciado'
               AND (CURRENT_DATE - a.fecactividad) > 3
             {extra_where}
             ORDER BY dias_pendiente DESC
             LIMIT 20;
        """
        # Alertas no filtran por rango de fechas (son de toda la historia)
        cur.execute(q_alertas, params_filtros if params_filtros else [])
        alertas = [dict(r) for r in cur.fetchall()]

        # ── 9. Catálogos para filtros dimensionales (respetando scope) ─────
        if proyecto_ids_scope is None:
            cur.execute(
                "SELECT id::text, descontratoproyecto AS nombre FROM construccion.m_proyecto"
                " WHERE flgactivoproyecto = true ORDER BY descontratoproyecto;"
            )
            proyectos = [dict(r) for r in cur.fetchall()]
            cur.execute(
                "SELECT id::text, nbrarea AS nombre FROM construccion.m_area"
                " WHERE flgactivoarea = true ORDER BY nbrarea;"
            )
            areas = [dict(r) for r in cur.fetchall()]
        else:
            cur.execute(
                "SELECT id::text, descontratoproyecto AS nombre FROM construccion.m_proyecto"
                " WHERE flgactivoproyecto = true AND id = ANY(%s::uuid[])"
                " ORDER BY descontratoproyecto;",
                (proyecto_ids_scope,),
            )
            proyectos = [dict(r) for r in cur.fetchall()]
            cur.execute(
                "SELECT id::text, nbrarea AS nombre FROM construccion.m_area"
                " WHERE flgactivoarea = true AND proyecto_id = ANY(%s::uuid[])"
                " ORDER BY nbrarea;",
                (proyecto_ids_scope,),
            )
            areas = [dict(r) for r in cur.fetchall()]

        cur.execute(
            "SELECT id::text, nbrcategoria AS nombre FROM construccion.m_categoria_trabajador"
            " WHERE flgactivocategoria = true ORDER BY nbrcategoria;"
        )
        categorias = [dict(r) for r in cur.fetchall()]

    return {
        "kpis": kpis,
        "kpis_prev": kpis_prev,
        "tendencia": tendencia,
        "top_trabajadores": top_trabajadores,
        "por_categoria": por_categoria,
        "por_cc": por_cc,
        "heatmap": heatmap,
        "alertas": alertas,
        "catalogos": {
            "proyectos": proyectos,
            "areas": areas,
            "categorias": categorias,
        },
    }
