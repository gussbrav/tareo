-- ============================================================
-- V015 — Flag "password_must_change" para forzar cambio en primer login.
--
-- Flujo:
--  1. Admin crea usuario → backend genera password temporal random,
--     la retorna UNA vez en la response y setea must_change = true.
--  2. Usuario se loguea con esa password → JWT y /me incluyen el flag.
--  3. Frontend detecta el flag y muestra pantalla obligatoria de cambio.
--  4. Usuario setea nueva password (validada por complejidad) →
--     backend limpia el flag.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS password_must_change boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN auth.users.password_must_change IS
    'Si true, el usuario está obligado a cambiar su password en el próximo '
    'login. Se setea al crear usuario (password temporal generada por admin) '
    'y se limpia después de un cambio exitoso.';
