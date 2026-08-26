-- ============================================================
-- V014 — Scoping por proyecto: trabajadores y usuarios a proyectos.
--
-- Modelo: dos tablas join M:N que definen a qué proyectos pertenecen
-- trabajadores y usuarios (supervisores/tareadores). Admin bypass a
-- nivel aplicación — no se les asigna nada, ven todo.
--
-- Backfill preserva behavior actual: cada trabajador y cada usuario
-- (no-admin) queda asignado a TODOS los proyectos activos. Cero
-- regresión al deployar; el admin ajusta cada uno después via UI.
--
-- Idempotente:
--   - CREATE TABLE IF NOT EXISTS
--   - Backfill con INSERT ... ON CONFLICT DO NOTHING
-- ============================================================

-- ── 1. Join: trabajador → proyectos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS construccion.trabajador_proyecto (
    trabajador_id  UUID NOT NULL REFERENCES construccion.m_trabajador(id) ON DELETE CASCADE,
    proyecto_id    UUID NOT NULL REFERENCES construccion.m_proyecto(id)   ON DELETE CASCADE,
    created_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (trabajador_id, proyecto_id)
);

CREATE INDEX IF NOT EXISTS idx_trabajador_proyecto_proyecto
    ON construccion.trabajador_proyecto (proyecto_id);
CREATE INDEX IF NOT EXISTS idx_trabajador_proyecto_trabajador
    ON construccion.trabajador_proyecto (trabajador_id);

COMMENT ON TABLE construccion.trabajador_proyecto IS
    'M:N — qué trabajadores pertenecen a qué proyectos. Un trabajador puede '
    'estar en 0 o más proyectos. Filtra la lista de trabajadores disponibles '
    'al crear actividades y en la vista del supervisor.';

-- ── 2. Join: usuario → proyectos (supervisores y tareadores) ───────────
CREATE TABLE IF NOT EXISTS auth.user_proyecto (
    user_id      UUID NOT NULL REFERENCES auth.users(id)                ON DELETE CASCADE,
    proyecto_id  UUID NOT NULL REFERENCES construccion.m_proyecto(id)   ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, proyecto_id)
);

CREATE INDEX IF NOT EXISTS idx_user_proyecto_proyecto
    ON auth.user_proyecto (proyecto_id);
CREATE INDEX IF NOT EXISTS idx_user_proyecto_user
    ON auth.user_proyecto (user_id);

COMMENT ON TABLE auth.user_proyecto IS
    'M:N — a qué proyectos tiene acceso un usuario (supervisor/trabajador). '
    'Admin no se asigna: bypass a nivel aplicación (ve todos).';

-- ── 3. Backfill — preservar el comportamiento anterior ────────────────
-- Todos los trabajadores activos se asignan a todos los proyectos activos.
INSERT INTO construccion.trabajador_proyecto (trabajador_id, proyecto_id)
SELECT t.id, p.id
  FROM construccion.m_trabajador t
 CROSS JOIN construccion.m_proyecto p
 WHERE t.flgativotrabajador = true
   AND p.flgactivoproyecto = true
ON CONFLICT DO NOTHING;

-- Todos los usuarios NO-admin activos se asignan a todos los proyectos activos.
INSERT INTO auth.user_proyecto (user_id, proyecto_id)
SELECT u.id, p.id
  FROM auth.users u
 CROSS JOIN construccion.m_proyecto p
 WHERE u.is_active = true
   AND u.role <> 'admin'
   AND p.flgactivoproyecto = true
ON CONFLICT DO NOTHING;
