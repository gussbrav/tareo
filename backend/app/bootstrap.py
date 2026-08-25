"""Bootstrap idempotente: crea admin inicial si no existe ningún admin."""
import logging
import os

from app.auth.password import hash_password
from app.database import get_db

logger = logging.getLogger(__name__)


def ensure_initial_admin() -> None:
    email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@azoramind.com")
    password = os.getenv("INITIAL_ADMIN_PASSWORD", "admin123")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) AS c FROM auth.users WHERE role = 'admin';")
            if cur.fetchone()["c"] > 0:
                logger.info("[bootstrap] admin ya existe, skip")
                return

            cur.execute(
                """
                INSERT INTO auth.users (email, password_hash, first_name, last_name, role, is_active)
                VALUES (%s, %s, %s, %s, 'admin', true)
                ON CONFLICT (email) DO NOTHING;
                """,
                (email, hash_password(password), "Admin", "Azoramind"),
            )
    logger.info("[bootstrap] admin creado: %s (cambiar password en primer login)", email)
