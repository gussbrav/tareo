-- ============================================================
-- V003 — Seed catálogos demo. Idempotente.
-- El usuario admin se crea desde Python al arrancar (bootstrap.py)
-- para no acoplar el schema al hash bcrypt de una versión de lib.
-- ============================================================

INSERT INTO construccion.m_area (codarea, nbrarea) VALUES
    ('10', 'Administración General'),
    ('20', 'Ventas'),
    ('21', 'Operaciones'),
    ('30', 'Servicios')
ON CONFLICT (codarea) DO NOTHING;

INSERT INTO construccion.m_proyecto (codproyecto, descontratoproyecto, desproyecto, nbrproyecto)
VALUES (1, 'DEMO-001', 'Proyecto demo Azoramind', 'Proyecto Demo')
ON CONFLICT DO NOTHING;
