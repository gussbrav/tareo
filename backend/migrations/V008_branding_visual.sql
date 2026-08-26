-- ============================================================
-- V008 — Branding visual: logo (data URL base64) + colores de marca.
-- Consumidos por /api/config/public (sin auth) para que Login, AppShell
-- y admin panel puedan pintarlos antes de que el user autentique.
-- Idempotente.
-- ============================================================

INSERT INTO public.system_settings (key, value, description) VALUES
    ('logo_url',            '', 'URL o data URL (base64) del logo del cliente. Se muestra en el header y login.'),
    ('brand_primary_color', '#1E40AF', 'Color primario de la marca (hex). Botones, header, acentos principales.'),
    ('brand_accent_color',  '#D4AF37', 'Color de acento (hex). Detalles, hover states, badges destacados.')
ON CONFLICT (key) DO NOTHING;
