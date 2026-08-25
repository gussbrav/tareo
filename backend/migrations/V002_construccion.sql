-- ============================================================
-- V002 — Schema construccion: catálogos + actividades (tareo).
-- Replica el DDL original de Grecia sin datos ni marca.
-- Idempotente.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS construccion;

-- ---------- m_area ----------
CREATE TABLE IF NOT EXISTS construccion.m_area (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codarea         varchar(30) NOT NULL,
    nbrarea         varchar(255) NOT NULL,
    flgactivoarea   boolean DEFAULT true,
    created_at      timestamptz DEFAULT now(),
    CONSTRAINT m_area_codarea_key UNIQUE (codarea)
);
CREATE INDEX IF NOT EXISTS idx_areas_codigo ON construccion.m_area (codarea);

-- ---------- m_especialidad ----------
CREATE TABLE IF NOT EXISTS construccion.m_especialidad (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codespecialidad         varchar(10) NOT NULL,
    nbrespecialidad         varchar(255) NOT NULL,
    area_id                 uuid NOT NULL REFERENCES construccion.m_area(id),
    flgactivoespecialidad   boolean DEFAULT true,
    created_at              timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_especialidades_area ON construccion.m_especialidad (area_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_especialidades_codigo_area
    ON construccion.m_especialidad (codespecialidad, area_id);

-- ---------- m_centrocosto ----------
CREATE TABLE IF NOT EXISTS construccion.m_centrocosto (
    id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codcentrocosto        varchar(10),
    nbrcentrocosto        varchar(255),
    especialidad_id       uuid REFERENCES construccion.m_especialidad(id),
    tipocentrocosto       varchar(50),
    codigo_ceco           varchar(50),
    ceco_palma            varchar(50),
    descentrocosto        text,
    desdestinocentrocosto varchar(50),
    flgactivocentrocosto  boolean DEFAULT true,
    created_at            timestamptz DEFAULT now(),
    CONSTRAINT m_centrocosto_codigo_ceco_key UNIQUE (codigo_ceco)
);
CREATE INDEX IF NOT EXISTS idx_centros_costo_especialidad ON construccion.m_centrocosto (especialidad_id);
CREATE INDEX IF NOT EXISTS idx_centros_costo_codigo_ceco ON construccion.m_centrocosto (codigo_ceco);

-- ---------- m_proyecto ----------
CREATE TABLE IF NOT EXISTS construccion.m_proyecto (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codproyecto             integer NOT NULL,
    descontratoproyecto     varchar(100),
    desproyecto             text,
    cliproyecto             varchar(255),
    mtocontractualproyecto  numeric(15,2),
    desduracionreal         varchar(100),
    descomentario           text,
    desdatoadjunto          text,
    nbrproyecto             varchar(255),
    flgactivoproyecto       boolean DEFAULT true,
    created_at              timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proyectos_codigo ON construccion.m_proyecto (codproyecto);

-- ---------- m_trabajador ----------
CREATE TABLE IF NOT EXISTS construccion.m_trabajador (
    id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    nbrcompleto            varchar(255) NOT NULL,
    numidentificacion      varchar(50),
    desareatrabajador      varchar(100),
    descategoriatrabajador varchar(100),
    desestadotrabajador    varchar(100) DEFAULT 'activo',
    fecingresotrabajador   timestamptz,
    flgativotrabajador     boolean DEFAULT true,
    created_at             timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trabajador_estado ON construccion.m_trabajador (desestadotrabajador);

-- FK diferida auth.users.trabajador_id -> construccion.m_trabajador.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema='auth' AND constraint_name='users_trabajador_fkey'
    ) THEN
        ALTER TABLE auth.users
            ADD CONSTRAINT users_trabajador_fkey
            FOREIGN KEY (trabajador_id) REFERENCES construccion.m_trabajador(id)
            ON DELETE SET NULL;
    END IF;
END$$;

-- ---------- m_actividad ----------
CREATE TABLE IF NOT EXISTS construccion.m_actividad (
    id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    trabajador_id            uuid NOT NULL REFERENCES construccion.m_trabajador(id),
    fecactividad             date NOT NULL,
    desactividad             text,
    horinicio                time with time zone DEFAULT (CURRENT_TIME AT TIME ZONE 'America/Lima'),
    horfin                   time with time zone,
    numduracionminuto        integer,
    descategoriatrabajador   varchar(100),
    codigo_ceco              varchar(50),
    numsemana                integer,
    desestadoactividad       varchar(50) DEFAULT 'iniciado',
    centro_costo_id          uuid NOT NULL REFERENCES construccion.m_centrocosto(id),
    proyecto_id              uuid NOT NULL REFERENCES construccion.m_proyecto(id),
    created_by               uuid NOT NULL REFERENCES auth.users(id),
    created_at               timestamptz DEFAULT now(),
    updated_at               timestamptz DEFAULT now(),
    updated_by               uuid REFERENCES auth.users(id),
    desobservaciones         text,
    horiniciorefrigerio      time with time zone DEFAULT '12:00:00'::time,
    horfinrefrigerio         time with time zone DEFAULT '13:00:00'::time,
    CONSTRAINT actividad_estado_check CHECK (desestadoactividad IN ('iniciado','finalizado'))
);
CREATE INDEX IF NOT EXISTS idx_actividad_fecha ON construccion.m_actividad (fecactividad DESC);
CREATE INDEX IF NOT EXISTS idx_actividad_trabajador_fecha
    ON construccion.m_actividad (trabajador_id, fecactividad);
CREATE INDEX IF NOT EXISTS idx_actividad_estado ON construccion.m_actividad (desestadoactividad);
CREATE INDEX IF NOT EXISTS idx_actividad_semana ON construccion.m_actividad (numsemana);
CREATE INDEX IF NOT EXISTS idx_actividad_cc ON construccion.m_actividad (centro_costo_id);
CREATE INDEX IF NOT EXISTS idx_actividad_proyecto ON construccion.m_actividad (proyecto_id);

-- ---------- funciones de negocio ----------

-- Finaliza una actividad individual (setea horfin y estado).
CREATE OR REPLACE FUNCTION construccion.finalizar_actividad(p_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_updated int;
BEGIN
    UPDATE construccion.m_actividad
       SET horfin = CURRENT_TIME AT TIME ZONE 'America/Lima',
           desestadoactividad = 'finalizado',
           updated_at = now(),
           numduracionminuto = EXTRACT(EPOCH FROM (
               (CURRENT_TIME AT TIME ZONE 'America/Lima')::time
               - horinicio::time
           )) / 60
     WHERE id = p_id AND desestadoactividad = 'iniciado';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN jsonb_build_object('updated', v_updated);
END;
$$ LANGUAGE plpgsql;

-- Finaliza en masa; ignora las que ya están finalizadas.
CREATE OR REPLACE FUNCTION construccion.finalizar_actividades_batch(p_ids uuid[])
RETURNS jsonb AS $$
DECLARE
    v_updated int;
BEGIN
    UPDATE construccion.m_actividad
       SET horfin = CURRENT_TIME AT TIME ZONE 'America/Lima',
           desestadoactividad = 'finalizado',
           updated_at = now(),
           numduracionminuto = EXTRACT(EPOCH FROM (
               (CURRENT_TIME AT TIME ZONE 'America/Lima')::time
               - horinicio::time
           )) / 60
     WHERE id = ANY(p_ids) AND desestadoactividad = 'iniciado';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN jsonb_build_object('updated', v_updated, 'requested', array_length(p_ids, 1));
END;
$$ LANGUAGE plpgsql;

-- trigger updated_at para m_actividad
CREATE OR REPLACE FUNCTION construccion.set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actividad_updated_at ON construccion.m_actividad;
CREATE TRIGGER trg_actividad_updated_at
    BEFORE UPDATE ON construccion.m_actividad
    FOR EACH ROW EXECUTE FUNCTION construccion.set_updated_at();
