-- ============================================================
-- V010 — Áreas pertenecen a un proyecto
--
-- Motivación: cada cliente puede tener proyectos con estructuras
-- distintas (Área > Especialidad > CC). Un mismo código de área puede
-- significar algo diferente en dos proyectos, o algunos proyectos
-- pueden no usar ciertas áreas.
--
-- Cambio: m_area recibe proyecto_id FK. La jerarquía CascadeS por
-- transitividad: especialidad → area → proyecto, cc → especialidad →
-- area → proyecto. No hace falta desnormalizar proyecto_id en las
-- tablas hijas.
--
-- La unique constraint global (codarea) se reemplaza por scoping por
-- proyecto (proyecto_id, codarea). Esto permite que el código '10'
-- exista en el proyecto A y también en el proyecto B con distinto
-- significado.
--
-- Idempotente. Safe migration:
--   - proyecto_id queda NULLABLE en DB para no romper si aún no hay
--     proyectos cargados. Backend valida NOT NULL vía Pydantic.
--   - Backfill asigna las áreas existentes al primer proyecto activo
--     (para no huerfanar datos actuales).
-- ============================================================

-- 1. Agregar columna proyecto_id (nullable, FK con ON DELETE CASCADE)
ALTER TABLE construccion.m_area
    ADD COLUMN IF NOT EXISTS proyecto_id UUID
    REFERENCES construccion.m_proyecto(id) ON DELETE CASCADE;

-- 2. Backfill: si hay proyectos activos y áreas sin proyecto, asignarlas
--    al primer proyecto activo por código. Se re-ejecuta safely (sólo
--    actualiza donde proyecto_id IS NULL).
DO $$
DECLARE
    v_proyecto_id UUID;
    v_area_count INT;
BEGIN
    SELECT id INTO v_proyecto_id
      FROM construccion.m_proyecto
     WHERE flgactivoproyecto = true
     ORDER BY codproyecto
     LIMIT 1;

    IF v_proyecto_id IS NOT NULL THEN
        UPDATE construccion.m_area
           SET proyecto_id = v_proyecto_id
         WHERE proyecto_id IS NULL;
        GET DIAGNOSTICS v_area_count = ROW_COUNT;
        IF v_area_count > 0 THEN
            RAISE NOTICE 'V010: backfilled % áreas al proyecto %', v_area_count, v_proyecto_id;
        END IF;
    END IF;
END$$;

-- 3. Reemplazar la UNIQUE global (codarea) por scoping por proyecto.
--    Áreas huérfanas (proyecto_id IS NULL) quedan fuera del índice
--    parcial y no rompen la constraint.
ALTER TABLE construccion.m_area DROP CONSTRAINT IF EXISTS m_area_codarea_key;
DROP INDEX IF EXISTS construccion.m_area_codarea_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_m_area_proyecto_codarea
    ON construccion.m_area (proyecto_id, codarea)
    WHERE proyecto_id IS NOT NULL;

-- 4. Índice de búsqueda por proyecto (endpoints list filtran por acá)
CREATE INDEX IF NOT EXISTS idx_m_area_proyecto ON construccion.m_area (proyecto_id);
