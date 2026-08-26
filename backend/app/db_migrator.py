"""Aplicador de migraciones SQL al arrancar el backend.

Convenciones (ver CLAUDE.md):
- Archivos en `backend/migrations/V<N>_<descripcion>.sql`.
- Cada versión es única. Duplicados en el prefijo `V<N>` son error fatal.
- SQL idempotente obligatorio.
- Tracker en `public._migrations`.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Dict, List, Tuple

from app.database import get_db

logger = logging.getLogger(__name__)

_VERSION_RE = re.compile(r"^V(\d+)(?:_\d+)?_[a-z0-9_]+\.sql$", re.IGNORECASE)


def _migrations_dir() -> Path:
    # backend/app/db_migrator.py -> backend/migrations
    return Path(__file__).resolve().parent.parent / "migrations"


def _ensure_tracker() -> None:
    # CREATE TABLE IF NOT EXISTS puede tirar duplicate_object si dos workers
    # corren esto en paralelo (race a nivel catalog). Lo tratamos como no-op:
    # cualquiera que gane crea la tabla, el resto sigue.
    from psycopg2 import errors as pg_errors

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public._migrations (
                        version     text PRIMARY KEY,
                        filename    text NOT NULL,
                        applied_at  timestamptz NOT NULL DEFAULT now()
                    );
                    """
                )
    except pg_errors.DuplicateObject:
        pass  # ya existe, otro worker la creó primero


def _discover() -> List[Tuple[str, Path]]:
    """Retorna [(version_key, path)] ordenado por versión numérica.

    version_key es el nombre del archivo sin extensión — así V007 y V007_2
    son entradas distintas.
    """
    d = _migrations_dir()
    if not d.exists():
        return []
    entries: List[Tuple[str, Path]] = []
    seen_primary: Dict[str, str] = {}  # V007 -> archivo primario
    for p in sorted(d.glob("V*.sql")):
        m = _VERSION_RE.match(p.name)
        if not m:
            logger.warning("[migrator] archivo ignorado (naming inválido): %s", p.name)
            continue
        version_key = p.stem  # V007_auth
        entries.append((version_key, p))

        # Chequeo de colisión: dos archivos con mismo V<N> sin sub-versión
        primary = f"V{int(m.group(1)):03d}"
        if "_" in p.stem.split("_", 1)[0]:
            pass  # nunca; el regex ya separó
        # Detectar dos archivos "V007_algo.sql" (sin _N_ sub-version)
        if not re.match(r"^V\d+_\d+_", p.name):
            if primary in seen_primary and seen_primary[primary] != p.name:
                raise RuntimeError(
                    f"[migrator] colisión de versión {primary}: "
                    f"{seen_primary[primary]} y {p.name}. "
                    f"Usa sub-version tipo V<N>_2_<desc>.sql para hotfixes."
                )
            seen_primary[primary] = p.name

    entries.sort(key=lambda x: x[0].lower())
    return entries


# Advisory lock key: entero arbitrario único para este app. Todos los procesos
# del backend usan el mismo → solo uno aplica migrations a la vez.
# Evita deadlock cuando uvicorn levanta 2+ workers y ambos intentan aplicar
# la misma migración simultáneamente (ejemplo real: V013 deploy Aug 2026).
_MIGRATOR_LOCK_KEY = 4820381_00


def apply_all() -> None:
    _ensure_tracker()

    # Tomamos UNA sola conexión para todo el ciclo — el pg_advisory_lock es
    # session-scoped, así que necesita mantenerse en la misma conexión hasta
    # el unlock. get_db() haría commit/rollback al salir del with y liberaría
    # la conexión; acá manejamos el lifecycle manualmente para blindar el lock.
    from app.database import _pool

    if _pool is None:
        raise RuntimeError("DB pool not initialized. Call init_pool() at startup.")
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SET TIME ZONE 'America/Lima';")
            # Bloqueante: el segundo worker duerme aquí hasta que el primero
            # termine todas las migrations y libere el lock.
            cur.execute("SELECT pg_advisory_lock(%s);", (_MIGRATOR_LOCK_KEY,))
        conn.commit()

        try:
            # Re-leer applied DENTRO del lock: si el otro worker ya aplicó
            # todo mientras esperábamos, no reintentamos.
            with conn.cursor() as cur:
                cur.execute("SELECT version FROM public._migrations;")
                applied = {row["version"] for row in cur.fetchall()}

            pending = [(v, p) for v, p in _discover() if v not in applied]
            if not pending:
                logger.info("[migrator] no hay migraciones pendientes")
                return

            for version, path in pending:
                sql = path.read_text(encoding="utf-8")
                logger.info("[migrator] aplicando %s ...", version)
                try:
                    with conn.cursor() as cur:
                        cur.execute(sql)
                        cur.execute(
                            "INSERT INTO public._migrations (version, filename) VALUES (%s, %s)",
                            (version, path.name),
                        )
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                logger.info("[migrator] OK %s", version)
        finally:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(%s);", (_MIGRATOR_LOCK_KEY,))
            conn.commit()
    finally:
        _pool.putconn(conn)
