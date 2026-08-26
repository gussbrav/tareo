"""Pool de conexiones Postgres.

Se instancia una única vez al arrancar (ver `main.lifespan`). Usar `get_db()`
como context manager para tomar y devolver conexiones al pool.
"""
from contextlib import contextmanager
from typing import Iterator

from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

from app.config import get_settings

_pool: ThreadedConnectionPool | None = None


def init_pool(minconn: int = 1, maxconn: int = 10) -> None:
    global _pool
    if _pool is not None:
        return
    settings = get_settings()
    _pool = ThreadedConnectionPool(
        minconn=minconn,
        maxconn=maxconn,
        dsn=settings.database_url,
        cursor_factory=RealDictCursor,
    )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


@contextmanager
def get_db() -> Iterator:
    """Yield una conexión del pool. Commit on success, rollback on error.

    Fija la zona horaria de la sesión a America/Lima para que CURRENT_DATE,
    CURRENT_TIMESTAMP y NOW() reflejen la hora local del negocio, no la del
    contenedor Postgres (que suele estar en UTC).
    """
    if _pool is None:
        raise RuntimeError("DB pool not initialized. Call init_pool() at startup.")
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SET TIME ZONE 'America/Lima';")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)
