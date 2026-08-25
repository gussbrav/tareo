"""Azoramind Tareo — entry point FastAPI."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.auth.router import router as auth_router
from app.bootstrap import ensure_demo_users, ensure_initial_admin
from app.config import get_settings
from app.database import close_pool, init_pool
from app.db_migrator import apply_all as apply_migrations
from app.routers.actividades import router as actividades_router
from app.routers.admin import router as admin_router
from app.routers.catalogos import router as catalogos_router
from app.routers.health import router as health_router
from app.routers.reportes import router as reportes_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Starting %s (env=%s)", settings.app_name, settings.app_env)
    init_pool()
    apply_migrations()
    ensure_initial_admin()
    ensure_demo_users()
    logger.info("Ready.")
    yield
    close_pool()
    logger.info("Bye.")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url=None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(catalogos_router)
    app.include_router(actividades_router)
    app.include_router(reportes_router)
    app.include_router(admin_router)

    # En prod servimos el bundle del frontend desde /static y catch-all a index.html
    static_dir = Path(__file__).resolve().parent.parent / "static"
    if static_dir.exists():
        app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

        @app.get("/", include_in_schema=False)
        @app.get("/{full_path:path}", include_in_schema=False)
        def _spa(full_path: str = ""):
            # No interceptar rutas de API.
            if full_path.startswith("api/") or full_path.startswith("docs") or full_path == "openapi.json":
                return {"detail": "not found"}
            index = static_dir / "index.html"
            if index.exists():
                return FileResponse(index)
            return {"detail": "frontend not built"}

    return app


app = create_app()
