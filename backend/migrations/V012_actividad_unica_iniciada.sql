-- ============================================================
-- V012 — Regla de negocio a nivel DB: un trabajador solo puede tener
-- UNA actividad 'iniciado' por fecha. Cierra la race condition entre
-- dos supervisores creando actividades al mismo tiempo.
--
-- Estrategia:
--  1. Auto-heal: si ya hay duplicados en prod, mantener el MÁS ANTIGUO
--     como iniciado y finalizar los demás (con horfin = horinicio y
--     duración 0). Se elige el más antiguo porque suele ser el registro
--     "real" y los duplicados suelen ser reintentos por lag de UI.
--  2. UNIQUE INDEX parcial: rechaza futuros duplicados a nivel DB.
--
-- Idempotente: la limpieza usa CTE + UPDATE con WHERE selectivo (no toca
-- filas ya únicas). El índice usa IF NOT EXISTS.
-- ============================================================

-- Paso 1: auto-heal — finalizar todos los duplicados excepto el más antiguo
--          por (trabajador_id, fecactividad, estado='iniciado').
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY trabajador_id, fecactividad
               ORDER BY created_at ASC, id ASC
           ) AS rn
      FROM construccion.m_actividad
     WHERE desestadoactividad = 'iniciado'
)
UPDATE construccion.m_actividad a
   SET desestadoactividad = 'finalizado',
       horfin = COALESCE(horfin, horinicio),
       numduracionminuto = 0
  FROM ranked r
 WHERE a.id = r.id
   AND r.rn > 1;

-- Paso 2: índice único parcial — cierra la puerta a futuros duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS ux_actividad_una_iniciada_por_dia
    ON construccion.m_actividad (trabajador_id, fecactividad)
 WHERE desestadoactividad = 'iniciado';

COMMENT ON INDEX construccion.ux_actividad_una_iniciada_por_dia IS
    'Un trabajador solo puede tener una actividad iniciada por fecha. '
    'La UI filtra en la lista de disponibles; este índice es el safety net '
    'ante race conditions o llamadas directas a la API.';
