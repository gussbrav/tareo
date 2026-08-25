-- ============================================================
-- V001 — Schema auth: usuarios, sesiones, intentos de login.
-- Auth reimplementado en Python (bcrypt + JWT). Ver app/auth/.
-- Idempotente.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS auth;

-- ---------- auth.users ----------
CREATE TABLE IF NOT EXISTS auth.users (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           varchar(255) NOT NULL,
    password_hash   varchar(255) NOT NULL,
    first_name      varchar(120),
    last_name       varchar(120),
    role            varchar(30) NOT NULL DEFAULT 'trabajador',
    trabajador_id   uuid,       -- FK diferida a construccion.m_trabajador (V002)
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    last_login_at   timestamptz,
    CONSTRAINT users_email_lower_unique UNIQUE (email),
    CONSTRAINT users_role_check CHECK (role IN ('admin','supervisor','trabajador'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_trabajador ON auth.users (trabajador_id);

-- ---------- auth.user_sessions ----------
CREATE TABLE IF NOT EXISTS auth.user_sessions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    refresh_token   varchar(512) NOT NULL,
    user_agent      text,
    ip_address      inet,
    created_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL,
    revoked_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON auth.user_sessions (refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_active
    ON auth.user_sessions (user_id) WHERE revoked_at IS NULL;

-- ---------- auth.login_attempts ----------
CREATE TABLE IF NOT EXISTS auth.login_attempts (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           varchar(255),
    ip_address      inet,
    success         boolean NOT NULL DEFAULT false,
    attempted_at    timestamptz NOT NULL DEFAULT now(),
    error_message   text
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON auth.login_attempts (email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON auth.login_attempts (ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON auth.login_attempts (attempted_at DESC);

-- ---------- trigger updated_at ----------
CREATE OR REPLACE FUNCTION auth.set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON auth.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION auth.set_updated_at();
