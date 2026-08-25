"""Acceso a datos del schema auth. Solo SQL, sin lógica de negocio."""
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from app.database import get_db


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM auth.users WHERE lower(email) = lower(%s) LIMIT 1;",
                (email,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def get_user_by_id(user_id: UUID) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM auth.users WHERE id = %s LIMIT 1;", (str(user_id),))
            row = cur.fetchone()
            return dict(row) if row else None


def update_last_login(user_id: UUID) -> None:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE auth.users SET last_login_at = now() WHERE id = %s;",
                (str(user_id),),
            )


def log_login_attempt(
    email: str,
    ip: Optional[str],
    success: bool,
    error: Optional[str] = None,
) -> None:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO auth.login_attempts (email, ip_address, success, error_message)
                VALUES (%s, %s, %s, %s);
                """,
                (email, ip, success, error),
            )


def create_session(
    user_id: UUID,
    refresh_token: str,
    expires_at: datetime,
    user_agent: Optional[str],
    ip: Optional[str],
) -> UUID:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO auth.user_sessions
                    (user_id, refresh_token, expires_at, user_agent, ip_address)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (str(user_id), refresh_token, expires_at, user_agent, ip),
            )
            return cur.fetchone()["id"]


def revoke_session_by_refresh(refresh_token: str) -> None:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE auth.user_sessions
                   SET revoked_at = now()
                 WHERE refresh_token = %s AND revoked_at IS NULL;
                """,
                (refresh_token,),
            )


def session_is_active(refresh_token: str) -> bool:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1 FROM auth.user_sessions
                 WHERE refresh_token = %s
                   AND revoked_at IS NULL
                   AND expires_at > now()
                 LIMIT 1;
                """,
                (refresh_token,),
            )
            return cur.fetchone() is not None
