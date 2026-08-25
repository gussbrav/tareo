"""Bootstrap idempotente: crea admin inicial + usuarios demo por rol."""
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


def ensure_demo_users() -> None:
    """Crea usuarios demo supervisor + trabajador si no existen.

    El trabajador queda linkeado al primer m_trabajador (para que ese usuario
    'vea' actividades reales al loguearse). Idempotente.
    """
    demos = [
        ("supervisor@azoramind.com", "supervisor123", "Supervisor", "Demo", "supervisor", None),
        ("trabajador@azoramind.com", "trabajador123", "Trabajador", "Demo", "trabajador", "link_first"),
    ]

    with get_db() as conn, conn.cursor() as cur:
        for email, pwd, fn, ln, role, link in demos:
            cur.execute("SELECT id FROM auth.users WHERE lower(email) = lower(%s);", (email,))
            if cur.fetchone():
                continue

            trabajador_id = None
            if link == "link_first":
                cur.execute(
                    """
                    SELECT id FROM construccion.m_trabajador
                     WHERE flgativotrabajador = true AND lower(desestadotrabajador) = 'activo'
                     ORDER BY nbrcompleto LIMIT 1;
                    """
                )
                row = cur.fetchone()
                if row:
                    trabajador_id = row["id"]

            cur.execute(
                """
                INSERT INTO auth.users
                    (email, password_hash, first_name, last_name, role, trabajador_id, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, true)
                ON CONFLICT (email) DO NOTHING;
                """,
                (email, hash_password(pwd), fn, ln, role, str(trabajador_id) if trabajador_id else None),
            )
            logger.info("[bootstrap] user demo %s (role=%s) creado", email, role)
