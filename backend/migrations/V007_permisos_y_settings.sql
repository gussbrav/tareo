-- ============================================================
-- V007 — Permisos configurables + settings de sistema (branding/empresa).
-- Reemplaza los role_gates hardcodeados por una matriz editable en DB.
-- Idempotente.
-- ============================================================

-- ─── auth.role_permissions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.role_permissions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    role            varchar(30) NOT NULL,
    permission_key  varchar(80) NOT NULL,
    allowed         boolean NOT NULL DEFAULT false,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT role_permissions_role_key_unique UNIQUE (role, permission_key),
    CONSTRAINT role_permissions_role_check CHECK (role IN ('admin','supervisor','trabajador'))
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup
    ON auth.role_permissions (role, permission_key) WHERE allowed = true;

-- Seed de la matriz vigente (misma que el AdminPermisos read-only mostraba).
-- Cada llave declara una capability. El backend consulta esta tabla vía
-- has_permission(role, key). Admin puede togglearlos en runtime.
INSERT INTO auth.role_permissions (role, permission_key, allowed) VALUES
    -- === autenticación ===
    ('admin',      'auth.login',                 true),
    ('supervisor', 'auth.login',                 true),
    ('trabajador', 'auth.login',                 true),

    -- === tareo (lectura) ===
    ('admin',      'tareo.ver_todos',            true),
    ('supervisor', 'tareo.ver_todos',            true),
    ('trabajador', 'tareo.ver_todos',            false),

    ('admin',      'tareo.ver_propias',          true),
    ('supervisor', 'tareo.ver_propias',          true),
    ('trabajador', 'tareo.ver_propias',          true),

    -- === actividades (escritura) ===
    ('admin',      'actividades.crear',          true),
    ('supervisor', 'actividades.crear',          true),
    ('trabajador', 'actividades.crear',          false),

    ('admin',      'actividades.editar',         true),
    ('supervisor', 'actividades.editar',         true),
    ('trabajador', 'actividades.editar',         false),

    ('admin',      'actividades.eliminar',       true),
    ('supervisor', 'actividades.eliminar',       false),
    ('trabajador', 'actividades.eliminar',       false),

    ('admin',      'actividades.finalizar',      true),
    ('supervisor', 'actividades.finalizar',      true),
    ('trabajador', 'actividades.finalizar',      true),

    -- === reportes ===
    ('admin',      'reportes.dashboard',         true),
    ('supervisor', 'reportes.dashboard',         true),
    ('trabajador', 'reportes.dashboard',         true),

    ('admin',      'reportes.export_excel',      true),
    ('supervisor', 'reportes.export_excel',      true),
    ('trabajador', 'reportes.export_excel',      false),

    -- === admin panel ===
    ('admin',      'admin.acceso',               true),
    ('supervisor', 'admin.acceso',               false),
    ('trabajador', 'admin.acceso',               false),

    ('admin',      'admin.trabajadores',         true),
    ('supervisor', 'admin.trabajadores',         false),
    ('trabajador', 'admin.trabajadores',         false),

    ('admin',      'admin.usuarios',             true),
    ('supervisor', 'admin.usuarios',             false),
    ('trabajador', 'admin.usuarios',             false),

    ('admin',      'admin.catalogos',            true),
    ('supervisor', 'admin.catalogos',            false),
    ('trabajador', 'admin.catalogos',            false),

    ('admin',      'admin.permisos',             true),
    ('supervisor', 'admin.permisos',             false),
    ('trabajador', 'admin.permisos',             false),

    ('admin',      'admin.settings',             true),
    ('supervisor', 'admin.settings',             false),
    ('trabajador', 'admin.settings',             false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- ─── public.system_settings ───────────────────────────────────────────────────
-- key/value store para configuración editable desde el admin panel.
-- Reemplaza (o complementa) las env vars COMPANY_NAME, COMPANY_TAXID.

CREATE TABLE IF NOT EXISTS public.system_settings (
    key         varchar(80) PRIMARY KEY,
    value       text,
    description text,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.system_settings (key, value, description) VALUES
    ('company_name',        'Azoramind Tareo', 'Nombre visible de la empresa (aparece en Excel y UI)'),
    ('company_taxid',       '',                'RUC/CUIT/Tax ID del cliente (aparece en el Excel)'),
    ('company_address',     '',                'Dirección fiscal (opcional, para futuros reportes)'),
    ('report_daily_hours',  '8.0',             'Horas de jornada legal para calcular sobretiempo'),
    ('report_lunch_minutes','60',              'Minutos de refrigerio a descontar por default'),
    ('timezone',            'America/Lima',    'Zona horaria para cálculos de horas'),
    ('app_environment_label','producción',     'Etiqueta del ambiente visible en la UI admin')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._settings_touch_updated() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_settings_touch ON public.system_settings;
CREATE TRIGGER trg_settings_touch
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public._settings_touch_updated();
