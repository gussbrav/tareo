-- ============================================================
-- V009 — sort_order en catálogos maestros + limpieza de seed
--
-- Motivación: el admin necesita poder reordenar filas via drag&drop en
-- Categorías / Áreas / Especialidades / Centros de costo / Proyectos.
-- Antes el orden lo imponía el backend (ORDER BY codigo/nombre); ahora
-- se persiste explícitamente y se puede ajustar desde la UI.
--
-- También se desactiva "Técnico" del seed por pedido del cliente actual
-- (soft-delete, reversible desde el admin si lo necesitan).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS, backfill sólo si sort_order = 0.
-- ============================================================

-- ── 1. sort_order en cada master ────────────────────────────────────────────

ALTER TABLE construccion.m_area              ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE construccion.m_especialidad      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE construccion.m_centrocosto       ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE construccion.m_proyecto          ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE construccion.m_categoria_trabajador ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- ── 2. Backfill del orden inicial ─────────────────────────────────────────
-- Se aplica sólo si aún no hay orden asignado (todos en 0), para no pisar
-- reordenamientos manuales si esta migración se ejecuta en un entorno que
-- ya tenía la columna con datos.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM construccion.m_area WHERE sort_order > 0) THEN
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY codarea)::int AS rn
              FROM construccion.m_area
        )
        UPDATE construccion.m_area a SET sort_order = o.rn FROM ordered o WHERE a.id = o.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM construccion.m_especialidad WHERE sort_order > 0) THEN
        WITH ordered AS (
            SELECT e.id, ROW_NUMBER() OVER (ORDER BY a.nbrarea NULLS LAST, e.codespecialidad)::int AS rn
              FROM construccion.m_especialidad e
              LEFT JOIN construccion.m_area a ON a.id = e.area_id
        )
        UPDATE construccion.m_especialidad e SET sort_order = o.rn FROM ordered o WHERE e.id = o.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM construccion.m_centrocosto WHERE sort_order > 0) THEN
        WITH ordered AS (
            SELECT cc.id, ROW_NUMBER() OVER (
                ORDER BY a.nbrarea NULLS LAST, e.nbrespecialidad NULLS LAST, cc.codcentrocosto
            )::int AS rn
              FROM construccion.m_centrocosto cc
              LEFT JOIN construccion.m_especialidad e ON e.id = cc.especialidad_id
              LEFT JOIN construccion.m_area a ON a.id = e.area_id
        )
        UPDATE construccion.m_centrocosto cc SET sort_order = o.rn FROM ordered o WHERE cc.id = o.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM construccion.m_proyecto WHERE sort_order > 0) THEN
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY codproyecto)::int AS rn
              FROM construccion.m_proyecto
        )
        UPDATE construccion.m_proyecto p SET sort_order = o.rn FROM ordered o WHERE p.id = o.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM construccion.m_categoria_trabajador WHERE sort_order > 0) THEN
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY codcategoria)::int AS rn
              FROM construccion.m_categoria_trabajador
        )
        UPDATE construccion.m_categoria_trabajador c SET sort_order = o.rn FROM ordered o WHERE c.id = o.id;
    END IF;
END$$;

-- ── 3. Índices para acelerar ORDER BY sort_order ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_m_area_sort              ON construccion.m_area (sort_order);
CREATE INDEX IF NOT EXISTS idx_m_especialidad_sort      ON construccion.m_especialidad (sort_order);
CREATE INDEX IF NOT EXISTS idx_m_centrocosto_sort       ON construccion.m_centrocosto (sort_order);
CREATE INDEX IF NOT EXISTS idx_m_proyecto_sort          ON construccion.m_proyecto (sort_order);
CREATE INDEX IF NOT EXISTS idx_m_categoria_trab_sort    ON construccion.m_categoria_trabajador (sort_order);

-- ── 4. Cleanup de seed: desactivar "Técnico" ─────────────────────────────
-- El cliente demo actual no lo usa. Soft-delete: el admin puede reactivarlo
-- desde el panel si lo necesita más adelante.

UPDATE construccion.m_categoria_trabajador
   SET flgactivocategoria = false
 WHERE codcategoria = 'TEC';
