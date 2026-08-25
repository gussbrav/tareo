# ============================================================
# Azoramind Tareo — Dockerfile prod (multi-stage).
# Etapa 1: build frontend (Vite).
# Etapa 2: backend Python que sirve el bundle estático.
# ============================================================

# ---------- Stage 1: frontend ----------
FROM node:20-alpine AS web-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
# En build el API base es relativo — mismo dominio que sirve el HTML.
ENV VITE_API_BASE_URL=""
RUN npm run build

# ---------- Stage 2: backend ----------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# libs de sistema mínimas para psycopg2-binary + bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY backend/ ./backend
# Bundle del frontend queda en backend/static/, servido por FastAPI (ver app/main.py)
COPY --from=web-build /app/dist ./backend/static

WORKDIR /app/backend
EXPOSE 8000

# Usuario no-root
RUN useradd --create-home --uid 10001 tareo && chown -R tareo:tareo /app
USER tareo

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers"]
