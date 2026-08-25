-- ============================================================
-- V006 — Normaliza categoría del trabajador a una tabla maestra
-- (antes era texto libre en m_trabajador.descategoriatrabajador).
-- Se mantiene la columna vieja para retro-compatibilidad y se sincroniza
-- desde el trigger al crear/editar via la nueva FK.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS construccion.m_categoria_trabajador (
    id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codcategoria          varchar(30) NOT NULL,
    nbrcategoria          varchar(120) NOT NULL,
    flgactivocategoria    boolean DEFAULT true,
    created_at            timestamptz DEFAULT now(),
    CONSTRAINT m_categoria_trabajador_cod_unique UNIQUE (codcategoria)
);
CREATE INDEX IF NOT EXISTS idx_categoria_trab_activo
    ON construccion.m_categoria_trabajador (flgactivocategoria) WHERE flgactivocategoria;

-- FK en m_trabajador. Nullable para que trabajadores existentes no se rompan.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='construccion' AND table_name='m_trabajador'
           AND column_name='categoria_id'
    ) THEN
        ALTER TABLE construccion.m_trabajador
            ADD COLUMN categoria_id uuid REFERENCES construccion.m_categoria_trabajador(id)
            ON DELETE SET NULL;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_trabajador_categoria
    ON construccion.m_trabajador (categoria_id);

-- Seed de categorías base (industria construcción — neutrales, funcionan para
-- servicios/industria general también).
INSERT INTO construccion.m_categoria_trabajador (codcategoria, nbrcategoria) VALUES
    ('OPE', 'Operario'),
    ('AYU', 'Ayudante'),
    ('MAE', 'Maestro'),
    ('SUP', 'Supervisor'),
    ('ADM', 'Administrativo'),
    ('TEC', 'Técnico'),
    ('OFI', 'Oficial')
ON CONFLICT (codcategoria) DO NOTHING;

-- Backfill: linkear los trabajadores existentes con su categoría por match de texto.
UPDATE construccion.m_trabajador t
   SET categoria_id = c.id
  FROM construccion.m_categoria_trabajador c
 WHERE t.categoria_id IS NULL
   AND lower(trim(t.descategoriatrabajador)) = lower(c.nbrcategoria);

-- Trigger: sincronizar descategoriatrabajador (legacy) desde categoria_id al insert/update.
CREATE OR REPLACE FUNCTION construccion.sync_categoria_trabajador() RETURNS trigger AS $$
BEGIN
    IF NEW.categoria_id IS NOT NULL THEN
        SELECT nbrcategoria INTO NEW.descategoriatrabajador
          FROM construccion.m_categoria_trabajador
         WHERE id = NEW.categoria_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trabajador_sync_categoria ON construccion.m_trabajador;
CREATE TRIGGER trg_trabajador_sync_categoria
    BEFORE INSERT OR UPDATE OF categoria_id ON construccion.m_trabajador
    FOR EACH ROW EXECUTE FUNCTION construccion.sync_categoria_trabajador();
