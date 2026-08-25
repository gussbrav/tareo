# CLAUDE.md — Azoramind Tareo

## Producto

App de **control de actividades y horas hombre** para PYMEs. Producto Azoramind vendible, vertical-agnóstico (constructoras, industria, servicios).

**Cliente actual:** demo comercial (nombre bajo NDA).
**Origen del código:** rebranded desde una app Appsmith que hizo Gustavo para Grecia200 (constructora peruana). Grecia NO se menciona en UI/copy/branding.

## Reglas de trabajo (leer siempre)

### 1. Pensar antes de codear
Ambigüedad → preguntar, no asumir. Cuando hay más de un camino, mostrar el tradeoff.

### 2. Simplicidad primero
Mínimo código que resuelve. Sin abstracciones especulativas. Sin "flexibilidad" para casos que nadie pidió.

### 3. Cambios quirúrgicos
Solo tocar lo que la tarea requiere. Un bug fix no refactoriza vecinos.

### 4. Producto vendible, no proyecto artesanal
- Todo string visible al usuario en **castellano peruano** (tuteo: tú/tienes/puedes).
- Cero mención de "Grecia" o cliente específico en UI. Todo neutro Azoramind.
- Branding: paleta azul Azoramind (`#1E40AF` primary), fondo blanco, acento dorado.
- Nombre visible: "Tareo".

### 5. Anti-alucinación
Antes de afirmar hechos técnicos: leer código, no inventar. Ver "Hechos verificados" más abajo.

## Reglas de oro (evaluar TODO cambio)

1. **Performance:** N+1 prohibidos; queries con índice; pool psycopg2 dimensionado.
2. **Extensibilidad:** SOLID (SRP fuerte), routers finos → services → db. Agregar cliente/módulo no debe tocar >2 archivos.
3. **Seguridad:** bcrypt cost 12, JWT firmado HS256, secrets solo en `.env` gitignored, CORS restringido, roles validados en cada endpoint.

## Ciclo de desarrollo (SDLC)

```
Design → Implementation → Testing → Deployment
```

- **Design:** entender lo que existe. Si toca arquitectura, actualizar este CLAUDE.md.
- **Implementation:** respetar convenciones (abajo). Cambios quirúrgicos.
- **Testing:** `pytest -q` verde antes de commit. Cobertura mínima 40% cuando maduremos.
- **Deployment:** commit → push main → EasyPanel autodeploy → smoke test `/api/health`.

## Stack (verificado)

| Capa | Tecnología |
|---|---|
| Web frontend | React 18 + Vite 5 + Tailwind 3 + Zustand + Axios |
| Backend | FastAPI 0.115 + psycopg2 |
| DB | PostgreSQL 17 (schemas `auth`, `construccion`) |
| Auth | bcrypt (passlib) + JWT (python-jose) |
| Deploy | Docker + EasyPanel (`tareo.azoramind.com`) |

## Hechos verificados (anti-alucinación)

- **Auth NO usa las funciones Postgres del Grecia original.** Se rehizo en Python con bcrypt+PyJWT. Tablas `auth.users`, `auth.user_sessions`, `auth.login_attempts`.
- **Schema `construccion`** replica el DDL original (m_area, m_especialidad, m_centrocosto, m_proyecto, m_trabajador, m_actividad) más funciones de negocio (`finalizar_actividad`, `finalizar_actividades_batch`).
- **Excel export** se hace en backend con `openpyxl`, NO se llama al workflow n8n `reporteexcel`.
- **Admin panel** son páginas React custom (no NocoDB separado).
- **Roles:** admin / supervisor / trabajador. Enforcement en dependencia FastAPI (`require_role`).
- **Migraciones:** numeradas `V001_*.sql`, `V002_*.sql`, ... Se aplican al arrancar el backend vía `db_migrator.py`. Tracker `_migrations` schema `public`. **Idempotencia obligatoria** (CREATE IF NOT EXISTS, ON CONFLICT DO NOTHING).

## Convenciones

### Idioma
- Identificadores, funciones, clases: **inglés**.
- Comentarios, mensajes al usuario: **castellano peruano** (tuteo).
- Nombres de tablas/columnas Postgres: `snake_case`, schema-qualified (`auth.users`, `construccion.m_actividad`).

### Naming
- Python: `snake_case`.
- JS/React: `camelCase` para vars/funcs, `PascalCase` para componentes.
- SQL: `snake_case`, prefijo `m_` para maestros, `t_` para transaccionales (siguiendo la convención del original).

### Estructura backend
```
routers/       # HTTP layer, solo parsea request y devuelve response
services/      # Lógica de negocio, orquesta repositorios
repositories/  # Solo SQL, sin lógica de negocio
schemas/       # Pydantic (request/response DTOs)
auth/          # cross-cutting: password, jwt, dependencies
```
Router NUNCA hace SQL directo. Service NUNCA hace HTTP.

### Git
- Commits: `feat(scope): ...` `fix(scope): ...` `chore(scope): ...` `db(scope): ...` `docs(scope): ...`.
- Cuerpo del commit explica el **por qué**, no el qué.
- Sin `--no-verify`. Sin `Co-Authored-By: Claude` trailer.
- Branch principal: `main`. Features grandes en `feature/nombre`.

### Migraciones
- Cada versión es **única**. Si hay hotfix sobre V007, nombrar `V007_2_hotfix_xxx.sql` (nunca duplicar prefijo `V007`).
- SQL **idempotente** siempre: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`.
- Probar local antes de push: backend arranca sin error, log `[migrator] applied V00N` visible.

## Deploy

- **Dev local:** `docker compose up --build` (levanta Postgres local + backend + frontend hot-reload).
- **Prod:** push a `main` → EasyPanel Azoramind detecta y redeploya → smoke test `https://tareo.azoramind.com/api/health`.
- **DB de prod:** `azoramind_tareo` en Postgres compartido del EasyPanel Azoramind.

## Contacto

**Azoramind** — Gustavo Bravo · gussbrav@gmail.com · [azoramind.com](https://www.azoramind.com)
