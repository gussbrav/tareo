from fastapi import APIRouter

from app.config import get_settings
from app.database import get_db

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    db_ok = False
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                db_ok = cur.fetchone() is not None
    except Exception:
        db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "app": settings.app_name,
        "env": settings.app_env,
        "db": "up" if db_ok else "down",
    }
