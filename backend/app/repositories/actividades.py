"""SQL de actividades. Sin lógica de negocio."""
from datetime import date, time
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.database import get_db


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


def list_by_date(fecha: date) -> List[Dict[str, Any]]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
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
             ORDER BY a.created_at DESC;
            """,
            (fecha,),
        )
        return [dict(r) for r in cur.fetchall()]


def list_by_month(
    year: int,
    month: int,
    trabajador_id: Optional[UUID] = None,
    proyecto_id: Optional[UUID] = None,
) -> List[Dict[str, Any]]:
    """Actividades de un mes completo, para vista agenda.
    Payload mínimo (pensado para renderizar pills de calendario)."""
    where = ["EXTRACT(YEAR FROM a.fecactividad) = %s", "EXTRACT(MONTH FROM a.fecactividad) = %s"]
    params: List[Any] = [year, month]
    if trabajador_id:
        where.append("a.trabajador_id = %s")
        params.append(str(trabajador_id))
    if proyecto_id:
        where.append("a.proyecto_id = %s")
        params.append(str(proyecto_id))
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


def list_by_trabajador(trabajador_id: UUID, fecha: date) -> List[Dict[str, Any]]:
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
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
             ORDER BY a.created_at DESC;
            """,
            (str(trabajador_id), fecha),
        )
        return [dict(r) for r in cur.fetchall()]


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
