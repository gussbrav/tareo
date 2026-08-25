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


def apply_all() -> None:
    _ensure_tracker()

    with get_db() as conn:
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
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO public._migrations (version, filename) VALUES (%s, %s)",
                    (version, path.name),
                )
        logger.info("[migrator] OK %s", version)
