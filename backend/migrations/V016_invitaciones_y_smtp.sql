-- ============================================================
-- V016 — Invitaciones por email + configuración SMTP.
--
-- Modelo:
--   1. Admin crea invitación (email + rol + trabajador_id opcional).
--   2. Backend genera token único, guarda fila, manda email via SMTP
--      configurado en public.system_settings.
--   3. Usuario recibe link tareo.azoramind.com/aceptar/{token}, setea
--      su propia contraseña, se crea auth.users y se marca la invitación
--      como usada.
--   4. La invitación expira en 7 días si no la aceptan.
--
-- La asignación de proyectos se hace por separado — el admin la configura
-- ANTES de invitar (en el mismo modal) y guarda los proyecto_ids en el
-- payload de la invitación para aplicarlos al aceptar.
--
-- Idempotente. Todo con IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ============================================================

-- ── 1. Tabla de invitaciones ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.invitations (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token         TEXT UNIQUE NOT NULL,
    email         TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin','supervisor','trabajador')),
    trabajador_id UUID REFERENCES construccion.m_trabajador(id) ON DELETE SET NULL,
    proyecto_ids  UUID[] NOT NULL DEFAULT '{}',
    first_name    TEXT,
    last_name     TEXT,
    invited_by    UUID NOT NULL REFERENCES auth.users(id),
    expires_at    TIMESTAMPTZ NOT NULL,
    used_at       TIMESTAMPTZ,
    used_by       UUID REFERENCES auth.users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token
    ON auth.invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_email_pending
    ON auth.invitations (lower(email))
    WHERE used_at IS NULL;

COMMENT ON TABLE auth.invitations IS
    'Invitaciones a nuevos usuarios. El admin crea la invitación y el sistema '
    'manda email con link. Al aceptar, se crea la fila en auth.users y se '
    'aplican los proyecto_ids que quedaron guardados en la invitación.';

-- ── 2. Settings SMTP en public.system_settings ─────────────────────────
INSERT INTO public.system_settings (key, value, description) VALUES
    ('smtp_host',      '',        'Host del servidor SMTP (ej. smtp.gmail.com, smtp.sendgrid.net)'),
    ('smtp_port',      '587',     'Puerto SMTP. 587 para STARTTLS, 465 para SSL/TLS'),
    ('smtp_user',      '',        'Usuario/email de autenticación SMTP'),
    ('smtp_password',  '',        'Contraseña o app-password SMTP. Se guarda encriptada en la respuesta a la UI'),
    ('smtp_from',      '',        'Email remitente (Ej. no-reply@tuempresa.com). Si vacío, usa smtp_user'),
    ('smtp_use_tls',   'true',    'Habilitar STARTTLS. true/false'),
    ('smtp_reject_unauthorized', 'true', 'Rechazar certificados no autorizados. true/false — recomendado true en producción')
ON CONFLICT (key) DO NOTHING;

-- ── 3. Auto-limpieza opcional (no bloqueante) ──────────────────────────
-- Nota: sin cron interno; el admin puede borrar manualmente invitaciones
-- vencidas desde la UI. Si en el futuro queremos auto-purga, agregar un
-- pg_cron o job externo que borre WHERE expires_at < now() - interval '30 days'.
