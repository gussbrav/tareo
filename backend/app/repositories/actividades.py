"""SQL de actividades. Sin lógica de negocio."""
from datetime import date, time
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.database import get_db


def find_trabajadores_con_iniciada(
    trabajador_ids: List[UUID],
    fecactividad: date,
) -> List[Dict[str, Any]]:
    """Devuelve los trabajadores del set que YA tienen una actividad
    'iniciado' esa fecha. Sirve para pre-validar antes de insert_bulk y
    devolver un error amigable listando los conflictos.

    Retorna [{id, nbrcompleto}] — vacío si no hay conflictos.
    """
    if not trabajador_ids:
        return []
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.id, t.nbrcompleto
              FROM construccion.m_trabajador t
              JOIN construccion.m_actividad a
                ON a.trabajador_id = t.id
               AND a.fecactividad = %s
               AND a.desestadoactividad = 'iniciado'
             WHERE t.id = ANY(%s::uuid[])
             ORDER BY t.nbrcompleto;
            """,
            (fecactividad, [str(i) for i in trabajador_ids]),
        )
        return [dict(r) for r in cur.fetchall()]


def insert_bulk(
    trabajador_ids: List[UUID],
    fecactividad: date,
    proyecto_id: UUID,
    centro_costo_id: UUID,
    desactividad: str,
    created_by: UUID,
) -> int:
    """Inserta N actividades (una por trabajador). Retorna cantidad insertada.

    Loop simple es aceptable: bulk-create suele ser <100 filas por operación.
    El caller debe validar duplicados de "iniciada por día" antes (ver
    find_trabajadores_con_iniciada). Si aun así llega una race condition, el
    UNIQUE INDEX parcial ux_actividad_una_iniciada_por_dia rechaza el INSERT
    con IntegrityError — el service lo captura y traduce a HTTP 409.
    """
    inserted = 0
    with get_db() as conn, conn.cursor() as cur:
        for trab_id in trabajador_ids:
            cur.execute(
                """
                INSERT INTO construccion.m_actividad
                    (trabajador_id, fecactividad, desactividad, centro_costo_id,
                     proyecto_id, created_by, numsemana)
                VALUES (%s::uuid, %s::date, %s, %s::uuid, %s::uuid, %s::uuid,
                        EXTRACT(WEEK FROM %s::date)::int);
                """,
                (
                    str(trab_id),
                    fecactividad,
                    desactividad,
                    str(centro_costo_id),
                    str(proyecto_id),
                    str(created_by),
                    fecactividad,
                ),
            )
            inserted += cur.rowcount
    return inserted


# Haystack para búsqueda: mismo criterio que el filtro client-side anterior
# (trabajador | actividad | estado | CC). Concat en un solo expr para que cada
# token buscado sea un ILIKE %tok% aplicado al string completo (equivalente a
# "todos los tokens deben aparecer en algún lado").
_HAYSTACK_EXPR = (
    "CONCAT_WS(' | ', "
    "t.nbrcompleto, "
    "COALESCE(a.desactividad, ''), "
    "a.desestadoactividad, "
    "COALESCE(cc.nbrcentrocosto, '')"
    ")"
)


def _search_clause(q: Optional[str]) -> tuple[str, List[Any]]:
    """Devuelve ('AND (...) AND (...)', [params]) según los tokens de q.
    Vacío si q es None o solo whitespace."""
    if not q:
        return "", []
    tokens = [t for t in q.strip().split() if t]
    if not tokens:
        return "", []
    clauses = []
    params: List[Any] = []
    for tok in tokens:
        clauses.append(f"{_HAYSTACK_EXPR} ILIKE %s")
        params.append(f"%{tok}%")
    return " AND " + " AND ".join(clauses), params


def list_by_date(
    fecha: date,
    q: Optional[str] = None,
    page: int = 1,
    size: int = 50,
    proyecto_ids: Optional[List[str]] = None,
    proyecto_id_filter: Optional[Any] = None,
) -> tuple[List[Dict[str, Any]], int]:
    """Actividades del día paginadas + total.

    `proyecto_ids` (scope de acceso del user):
      - None  → sin filtro (admin bypass)
      - [...] → WHERE proyecto_id = ANY(...)
      - []    → el caller lo maneja antes; aquí igual damos WHERE FALSE

    `proyecto_id_filter` (filtro adicional del "Proyecto activo" en UI):
      - None → no filtra
      - UUID → WHERE proyecto_id = %s (además del scope)

    Índices sobre fecactividad y proyecto_id hacen esto barato con miles.
    """
    search_sql, search_params = _search_clause(q)
    scope_sql = ""
    scope_params: List[Any] = []
    if proyecto_ids is not None:
        scope_sql += " AND a.proyecto_id = ANY(%s::uuid[])"
        scope_params.append(proyecto_ids)
    if proyecto_id_filter:
        scope_sql += " AND a.proyecto_id = %s::uuid"
        scope_params.append(str(proyecto_id_filter))
    offset = max(page - 1, 0) * size

    with get_db() as conn, conn.cursor() as cur:
        # 1. Total (mismo WHERE)
        cur.execute(
            f"""
            SELECT COUNT(*) AS n
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_centrocosto cc ON cc.id = a.centro_costo_id
             WHERE a.fecactividad = %s
             {scope_sql}
             {search_sql};
            """,
            (fecha, *scope_params, *search_params),
        )
        total = int(cur.fetchone()["n"])

        # 2. Página
        cur.execute(
            f"""
            SELECT a.id,
                   a.fecactividad,
                   TO_CHAR(a.fecactividad, 'FMDD Mon') AS fecdia_display,
                   a.trabajador_id,
                   t.nbrcompleto AS trabajador_nombre,
                   a.desactividad,
                   a.horinicio::time AS horinicio,
                   a.horfin::time AS horfin,
                   a.desestadoactividad,
                   a.numduracionminuto,
                   cc.nbrcentrocosto AS centro_costo_nombre,
                   p.nbrproyecto AS proyecto_nombre,
                   CONCAT(
                       'Estado: ', a.desestadoactividad,
                       ' | Inicio: ', COALESCE(TO_CHAR(a.horinicio::time, 'HH24:MI'), '--:--'),
                       CASE WHEN a.horfin IS NOT NULL
                            THEN CONCAT(' - Fin: ', TO_CHAR(a.horfin::time, 'HH24:MI'))
                            ELSE ' - En proceso' END
                   ) AS detalle_resumido
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_centrocosto cc ON cc.id = a.centro_costo_id
              LEFT JOIN construccion.m_proyecto p ON p.id = a.proyecto_id
             WHERE a.fecactividad = %s
             {scope_sql}
             {search_sql}
             ORDER BY a.created_at DESC
             LIMIT %s OFFSET %s;
            """,
            (fecha, *scope_params, *search_params, size, offset),
        )
        items = [dict(r) for r in cur.fetchall()]
    return items, total


def list_by_month(
    year: int,
    month: int,
    trabajador_id: Optional[UUID] = None,
    proyecto_id: Optional[UUID] = None,
    proyecto_ids_scope: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Actividades del mes para vista agenda. Aplica scope por proyectos
    accesibles (`proyecto_ids_scope`) además del filtro específico opcional."""
    where = ["EXTRACT(YEAR FROM a.fecactividad) = %s", "EXTRACT(MONTH FROM a.fecactividad) = %s"]
    params: List[Any] = [year, month]
    if trabajador_id:
        where.append("a.trabajador_id = %s")
        params.append(str(trabajador_id))
    if proyecto_id:
        where.append("a.proyecto_id = %s")
        params.append(str(proyecto_id))
    if proyecto_ids_scope is not None:
        where.append("a.proyecto_id = ANY(%s::uuid[])")
        params.append(proyecto_ids_scope)
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT a.id,
                   TO_CHAR(a.fecactividad, 'YYYY-MM-DD') AS fecha_dia,
                   a.trabajador_id,
                   t.nbrcompleto AS trabajador_nombre,
                   a.desactividad,
                   a.horinicio::time AS horinicio,
                   a.horfin::time AS horfin,
                   a.desestadoactividad,
                   a.numduracionminuto,
                   a.proyecto_id,
                   p.nbrproyecto AS proyecto_nombre,
                   a.centro_costo_id,
                   cc.nbrcentrocosto AS centro_costo_nombre
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_centrocosto cc ON cc.id = a.centro_costo_id
              LEFT JOIN construccion.m_proyecto p ON p.id = a.proyecto_id
             WHERE {' AND '.join(where)}
             ORDER BY a.fecactividad, a.horinicio NULLS LAST, a.created_at;
            """,
            tuple(params),
        )
        return [dict(r) for r in cur.fetchall()]


def list_by_trabajador(
    trabajador_id: UUID,
    fecha: date,
    q: Optional[str] = None,
    page: int = 1,
    size: int = 50,
) -> tuple[List[Dict[str, Any]], int]:
    """Actividades del día del trabajador logueado, paginadas + total.
    Volumen típico es bajo (<20/día) pero mantenemos misma forma que list_by_date
    para consistencia del contrato del endpoint."""
    search_sql, search_params = _search_clause(q)
    offset = max(page - 1, 0) * size

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT COUNT(*) AS n
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_centrocosto cc ON cc.id = a.centro_costo_id
             WHERE a.trabajador_id = %s AND a.fecactividad = %s
             {search_sql};
            """,
            (str(trabajador_id), fecha, *search_params),
        )
        total = int(cur.fetchone()["n"])

        cur.execute(
            f"""
            SELECT a.id, a.fecactividad,
                   TO_CHAR(a.fecactividad, 'FMDD Mon') AS fecdia_display,
                   a.trabajador_id, t.nbrcompleto AS trabajador_nombre,
                   a.desactividad,
                   a.horinicio::time AS horinicio, a.horfin::time AS horfin,
                   a.desestadoactividad, a.numduracionminuto,
                   cc.nbrcentrocosto AS centro_costo_nombre,
                   p.nbrproyecto AS proyecto_nombre,
                   CONCAT(
                       'Estado: ', a.desestadoactividad,
                       ' | Inicio: ', COALESCE(TO_CHAR(a.horinicio::time, 'HH24:MI'), '--:--'),
                       CASE WHEN a.horfin IS NOT NULL
                            THEN CONCAT(' - Fin: ', TO_CHAR(a.horfin::time, 'HH24:MI'))
                            ELSE ' - En proceso' END
                   ) AS detalle_resumido
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_centrocosto cc ON cc.id = a.centro_costo_id
              LEFT JOIN construccion.m_proyecto p ON p.id = a.proyecto_id
             WHERE a.trabajador_id = %s AND a.fecactividad = %s
             {search_sql}
             ORDER BY a.created_at DESC
             LIMIT %s OFFSET %s;
            """,
            (str(trabajador_id), fecha, *search_params, size, offset),
        )
        items = [dict(r) for r in cur.fetchall()]
    return items, total


def get_by_id(actividad_id: UUID) -> Optional[Dict[str, Any]]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.id, a.fecactividad, a.trabajador_id, t.nbrcompleto AS trabajador_nombre,
                   a.desactividad, a.horinicio::time AS horinicio, a.horfin::time AS horfin,
                   a.desestadoactividad, a.desobservaciones,
                   a.centro_costo_id, cc.nbrcentrocosto AS centro_costo_nombre,
                   a.proyecto_id, p.nbrproyecto AS proyecto_nombre,
                   a.created_at, a.updated_at
              FROM construccion.m_actividad a
              JOIN construccion.m_trabajador t ON t.id = a.trabajador_id
              LEFT JOIN construccion.m_centrocosto cc ON cc.id = a.centro_costo_id
              LEFT JOIN construccion.m_proyecto p ON p.id = a.proyecto_id
             WHERE a.id = %s
             LIMIT 1;
            """,
            (str(actividad_id),),
        )
        r = cur.fetchone()
        return dict(r) if r else None


def update(
    actividad_id: UUID,
    updated_by: UUID,
    desactividad: Optional[str],
    horinicio: Optional[time],
    horfin: Optional[time],
    desestadoactividad: Optional[str],
    desobservaciones: Optional[str],
) -> int:
    sets = []
    params: List[Any] = []
    if desactividad is not None:
        sets.append("desactividad = %s"); params.append(desactividad)
    if horinicio is not None:
        sets.append("horinicio = %s::time"); params.append(horinicio.isoformat())
    if horfin is not None:
        sets.append("horfin = %s::time"); params.append(horfin.isoformat())
    if desestadoactividad is not None:
        sets.append("desestadoactividad = %s"); params.append(desestadoactividad)
    if desobservaciones is not None:
        sets.append("desobservaciones = %s"); params.append(desobservaciones)

    if not sets:
        return 0

    sets.append("updated_by = %s::uuid"); params.append(str(updated_by))
    # Duración se recalcula si tenemos ambos horarios (o post-update mismo).
    sql = f"""
        UPDATE construccion.m_actividad
           SET {", ".join(sets)},
               numduracionminuto = CASE
                   WHEN horfin IS NOT NULL AND horinicio IS NOT NULL
                   THEN GREATEST(0, (EXTRACT(EPOCH FROM (horfin::time - horinicio::time)) / 60)::int)
                   ELSE numduracionminuto
               END
         WHERE id = %s;
    """
    params.append(str(actividad_id))
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(sql, tuple(params))
        return cur.rowcount


def delete(actividad_id: UUID) -> int:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM construccion.m_actividad WHERE id = %s;", (str(actividad_id),))
        return cur.rowcount


def finalize_batch(ids: List[UUID]) -> Dict[str, int]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT construccion.finalizar_actividades_batch(%s::uuid[]) AS r;",
            ([str(i) for i in ids],),
        )
        result = cur.fetchone()["r"]
        return {
            "updated": int(result.get("updated") or 0),
            "requested": int(result.get("requested") or len(ids)),
        }


def finalize_one(actividad_id: UUID) -> Dict[str, int]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT construccion.finalizar_actividad(%s) AS r;",
            (str(actividad_id),),
        )
        result = cur.fetchone()["r"]
        return {"updated": int(result.get("updated") or 0), "requested": 1}
