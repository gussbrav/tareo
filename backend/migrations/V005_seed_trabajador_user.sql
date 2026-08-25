-- ============================================================
-- V005 — Seed usuario demo con rol 'trabajador' linkeado al primer
-- trabajador de la lista. Password se setea desde bootstrap.py.
-- El link a trabajador_id se hace vía UPDATE post-inserción por Python
-- porque la password real se hashea allá.
-- Idempotente.
-- ============================================================

-- Aseguramos usuario supervisor demo (para probar el 3er rol).
-- El password real lo maneja bootstrap.py; acá solo garantizamos que existan
-- las shells (con hash bcrypt de 'trabajador123' y 'supervisor123' fijos).
-- Si te preocupa hardcodear, cambialo con el endpoint /api/auth (futuro).

-- NADA que ejecutar en SQL puro; ver app/bootstrap.py: ensure_demo_users().
SELECT 1;
