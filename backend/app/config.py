from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración de la app cargada desde variables de entorno.

    Todo hardcode queda prohibido: cambiar comportamiento entre entornos
    se hace tocando .env, nunca el código.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = Field(..., min_length=10)

    jwt_secret_key: str = Field(..., min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    app_name: str = "Azoramind Tareo"
    app_env: str = "development"
    app_debug: bool = False
    app_timezone: str = "America/Lima"

    allowed_origins: str = "http://localhost:5173"

    # Branding del cliente (aparece en reportes/exports).
    company_name: str = "Azoramind Tareo"
    company_taxid: str = ""
    report_daily_hours: float = 8.0
    report_lunch_minutes: int = 60

    @field_validator("allowed_origins")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        return ",".join(o.strip() for o in v.split(",") if o.strip())

    @property
    def cors_origins_list(self) -> List[str]:
        return [o for o in self.allowed_origins.split(",") if o]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


def get_setting_from_db(key: str, fallback: str = "") -> str:
    """Lee una setting desde public.system_settings.

    Si la DB no tiene el registro (aún no migró) o hay error, devuelve el
    fallback (que suele venir de env var). Silencioso — nunca rompe requests.
    """
    try:
        from app.database import get_db
        with get_db() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT value FROM public.system_settings WHERE key = %s LIMIT 1;",
                (key,),
            )
            row = cur.fetchone()
            if row and row["value"]:
                return row["value"]
    except Exception:
        pass
    return fallback


@lru_cache
def get_settings() -> Settings:
    return Settings()
