# Azoramind Tareo

App de control de actividades y horas hombre para PYMEs. Producto Azoramind.

## Stack

- **Backend:** FastAPI + psycopg2 (Postgres 17)
- **Frontend:** React + Vite + Tailwind
- **Auth:** JWT (bcrypt + PyJWT)
- **Deploy:** Docker + EasyPanel
- **Dominio demo:** `tareo.azoramind.com`

## Estructura

```
grecia-tareo/
├── backend/               # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── db_migrator.py
│   │   ├── auth/          # JWT, password hashing, dependencies
│   │   ├── routers/       # Endpoints REST
│   │   ├── services/      # Lógica de negocio
│   │   └── schemas/       # Pydantic models
│   ├── migrations/        # V001_*.sql, V002_*.sql ... (idempotent)
│   ├── tests/
│   └── requirements.txt
├── frontend/              # React SPA
│   ├── src/
│   │   ├── api/           # Axios client
│   │   ├── pages/         # Login, Dashboard, Actividades, ...
│   │   ├── components/    # Reutilizables
│   │   ├── store/         # Zustand
│   │   └── lib/           # utils
│   ├── index.html
│   └── package.json
├── docker-compose.yml     # Dev local (backend + frontend + postgres)
├── Dockerfile             # Prod (backend sirve dist/ del frontend)
└── .env.example
```

## Setup local

```bash
# 1. Clonar y copiar env
cp .env.example .env
# editar .env con DATABASE_URL y JWT_SECRET_KEY reales

# 2. Backend (crear venv y correr)
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev  # http://localhost:5173
```

O con Docker Compose (levanta todo + Postgres local):

```bash
docker compose up --build
```

## Roles

| Rol | Puede |
|---|---|
| `admin` | Todo + panel admin (CRUD de tablas maestras y usuarios) |
| `supervisor` | Crear actividades para su equipo, ver reportes |
| `trabajador` | Ver sus asignaciones y finalizarlas |

## Documentación

- API OpenAPI: `http://localhost:8000/docs` (Swagger UI, dev only)
- CLAUDE.md — reglas de contribución y contexto

---

Desarrollado por [Azoramind](https://www.azoramind.com) · Gustavo Bravo
