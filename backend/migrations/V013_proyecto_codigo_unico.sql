-- ============================================================
-- V013 — Regla de negocio a nivel DB: codproyecto único.
-- Cierra el bug: la UI permitía crear DEMO-02 con código 1 aunque ya
-- existiera DEMO-001 con el mismo código.
--
-- Estrategia:
--  1. Auto-heal: si en prod ya hay duplicados de codproyecto, renumbera
--     los más recientes (mantiene el más antiguo con su código, los demás
--     se corren al siguiente disponible = MAX + rank).
--  2. UNIQUE INDEX en (codproyecto): rechaza futuros duplicados a nivel DB.
--
-- Idempotente: la limpieza es una sola query con WHERE selectivo (no toca
-- filas ya únicas). El índice usa IF NOT EXISTS.
-- ============================================================

-- Paso 1: auto-heal — renumerar duplicados.
-- Para cada grupo de codproyecto duplicado, el más antiguo queda con su
-- código original. Los demás se renumeran a MAX_global + rank_dentro_grupo.
WITH ranked AS (
    SELECT id,
           codproyecto,
           ROW_NUMBER() OVER (
               PARTITION BY codproyecto
               ORDER BY created_at ASC NULLS LAST, id ASC
           ) AS rn
      FROM construccion.m_proyecto
),
max_code AS (
    SELECT COALESCE(MAX(codproyecto), 0) AS m FROM construccion.m_proyecto
)
UPDATE construccion.m_proyecto p
   SET codproyecto = (SELECT m FROM max_code) + r.rn - 1
  FROM ranked r, max_code
 WHERE p.id = r.id
   AND r.rn > 1;

-- Paso 2: índice único — cierra la puerta a futuros duplicados.
-- Reemplaza el índice no-único idx_proyectos_codigo con uno UNIQUE.
DROP INDEX IF EXISTS construccion.idx_proyectos_codigo;
CREATE UNIQUE INDEX IF NOT EXISTS ux_proyecto_codigo
    ON construccion.m_proyecto (codproyecto);

COMMENT ON INDEX construccion.ux_proyecto_codigo IS
    'codproyecto es único a nivel proyecto — cada proyecto tiene un código '
    'distinto. Enforced en DB para blindar la validación de la UI/API.';
