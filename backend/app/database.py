"""Pool de conexiones Postgres.

Se instancia una única vez al arrancar (ver `main.lifespan`). Usar `get_db()`
como context manager para tomar y devolver conexiones al pool.

Resiliencia:
- init_pool retry con backoff: si Postgres no está listo cuando arranca el
  backend (típico en deploys en cascada de EasyPanel/docker-compose), el
  proceso espera en vez de crashear.
- get_db chequea que la conexión esté viva antes de usarla; si el pool
  quedó con conexiones muertas (Postgres reinició), reemplaza esa conexión
  transparentemente antes de yield.
"""
import logging
import time
from contextlib import contextmanager
from typing import Iterator

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

from app.config import get_settings

logger = logging.getLogger(__name__)

_pool: ThreadedConnectionPool | None = None

# Retry al inicializar: útil cuando EasyPanel redeploya otros servicios y
# el DNS interno o Postgres quedan momentáneamente inaccesibles. Total ~60s.
_INIT_MAX_ATTEMPTS = 30
_INIT_BACKOFF_SEC = 2


def init_pool(minconn: int = 1, maxconn: int = 10) -> None:
    """Inicializa el pool. Reintenta hasta ~60s si Postgres no está listo.

    Errores típicos que reintentamos:
    - could not translate host name (DNS interno de EasyPanel caído)
    - Connection refused (Postgres está reiniciando)
    - server closed the connection unexpectedly
    """
    global _pool
    if _pool is not None:
        return
    settings = get_settings()
    last_err: Exception | None = None
    for attempt in range(1, _INIT_MAX_ATTEMPTS + 1):
        try:
            _pool = ThreadedConnectionPool(
                minconn=minconn,
                maxconn=maxconn,
                dsn=settings.database_url,
                cursor_factory=RealDictCursor,
                # Corta el intento rápido si la DB no responde — permite
                # que el retry loop haga más iteraciones dentro del window.
                connect_timeout=5,
            )
            if attempt > 1:
                logger.info("[db] pool conectado en intento %d/%d", attempt, _INIT_MAX_ATTEMPTS)
            return
        except psycopg2.OperationalError as e:
            last_err = e
            # Solo logueamos el primer error y el último para no llenar
            # el log con la misma traza N veces.
            if attempt == 1 or attempt == _INIT_MAX_ATTEMPTS:
                logger.warning(
                    "[db] init_pool intento %d/%d falló: %s",
                    attempt, _INIT_MAX_ATTEMPTS, str(e).strip(),
                )
            time.sleep(_INIT_BACKOFF_SEC)
    # Si agotamos los intentos, propagamos — EasyPanel reintentará el
    # container. Al menos ya no fallamos por un blip de 5 segundos.
    logger.error("[db] init_pool fallado tras %d intentos", _INIT_MAX_ATTEMPTS)
    raise last_err if last_err else RuntimeError("init_pool failed")


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


def _connection_is_alive(conn) -> bool:
    """Rápido SELECT 1 para descartar conexiones muertas (Postgres reinició)."""
    try:
        # closed 0=open, 1=explicitly closed, 2=broken. Si no es 0, dead.
        if conn.closed:
            return False
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
        return True
    except psycopg2.Error:
        return False


@contextmanager
def get_db() -> Iterator:
    """Yield una conexión del pool. Commit on success, rollback on error.

    - Fija la zona horaria de la sesión a America/Lima para que CURRENT_DATE,
      CURRENT_TIMESTAMP y NOW() reflejen la hora local del negocio (no UTC).
    - Health-check ligero: si la conexión que sacamos del pool está muerta
      (típico si Postgres reinició mientras el backend estaba vivo),
      la descartamos y sacamos otra. Segundo intento sin health-check.
    """
    if _pool is None:
        raise RuntimeError("DB pool not initialized. Call init_pool() at startup.")

    conn = _pool.getconn()
    if not _connection_is_alive(conn):
        # Descartar conexión muerta y pedir otra. `close=True` fuerza que
        # el pool la reemplace en su próximo getconn().
        _pool.putconn(conn, close=True)
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
