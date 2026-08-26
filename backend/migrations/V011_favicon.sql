-- ============================================================
-- V011 — Favicon del sitio (icono de pestaña del navegador).
-- Se guarda como data URL base64 igual que logo_url. La UI lo inyecta
-- en <link rel="icon"> en runtime cuando carga /api/config/public.
-- Idempotente.
-- ============================================================

INSERT INTO public.system_settings (key, value, description) VALUES
    ('favicon_url', '', 'URL o data URL (base64) del favicon (icono de pestaña). Se recomienda 32x32 o 64x64 px, formato ICO, PNG o SVG.')
ON CONFLICT (key) DO NOTHING;
