-- ============================================================
-- V004 — Seed adicional para poder probar el flujo end-to-end.
-- Datos neutros (sin marca ni PII real). Idempotente.
-- ============================================================

-- Especialidades demo, ancladas al área "Operaciones" (código 21).
INSERT INTO construccion.m_especialidad (codespecialidad, nbrespecialidad, area_id)
SELECT '01', 'Servicios Generales', a.id FROM construccion.m_area a WHERE a.codarea = '21'
ON CONFLICT DO NOTHING;

INSERT INTO construccion.m_especialidad (codespecialidad, nbrespecialidad, area_id)
SELECT '02', 'Mantenimiento', a.id FROM construccion.m_area a WHERE a.codarea = '21'
ON CONFLICT DO NOTHING;

INSERT INTO construccion.m_especialidad (codespecialidad, nbrespecialidad, area_id)
SELECT '01', 'Recepción y Atención', a.id FROM construccion.m_area a WHERE a.codarea = '10'
ON CONFLICT DO NOTHING;

-- Centros de costo demo, uno por especialidad creada.
INSERT INTO construccion.m_centrocosto (codcentrocosto, nbrcentrocosto, especialidad_id, tipocentrocosto, codigo_ceco)
SELECT '1', 'Mano de Obra', e.id, 'Costo Directo', 'DEMO-MO-001'
  FROM construccion.m_especialidad e
  JOIN construccion.m_area a ON a.id = e.area_id
 WHERE a.codarea = '21' AND e.codespecialidad = '01'
ON CONFLICT (codigo_ceco) DO NOTHING;

INSERT INTO construccion.m_centrocosto (codcentrocosto, nbrcentrocosto, especialidad_id, tipocentrocosto, codigo_ceco)
SELECT '2', 'Materiales', e.id, 'Costo Directo', 'DEMO-MAT-001'
  FROM construccion.m_especialidad e
  JOIN construccion.m_area a ON a.id = e.area_id
 WHERE a.codarea = '21' AND e.codespecialidad = '01'
ON CONFLICT (codigo_ceco) DO NOTHING;

INSERT INTO construccion.m_centrocosto (codcentrocosto, nbrcentrocosto, especialidad_id, tipocentrocosto, codigo_ceco)
SELECT '1', 'Mano de Obra', e.id, 'Costo Directo', 'DEMO-MO-002'
  FROM construccion.m_especialidad e
  JOIN construccion.m_area a ON a.id = e.area_id
 WHERE a.codarea = '21' AND e.codespecialidad = '02'
ON CONFLICT (codigo_ceco) DO NOTHING;

INSERT INTO construccion.m_centrocosto (codcentrocosto, nbrcentrocosto, especialidad_id, tipocentrocosto, codigo_ceco)
SELECT '1', 'Atención al Cliente', e.id, 'Costo Indirecto', 'DEMO-AT-001'
  FROM construccion.m_especialidad e
  JOIN construccion.m_area a ON a.id = e.area_id
 WHERE a.codarea = '10' AND e.codespecialidad = '01'
ON CONFLICT (codigo_ceco) DO NOTHING;

-- Trabajadores demo (nombres ficticios, sin PII real).
INSERT INTO construccion.m_trabajador
    (nbrcompleto, numidentificacion, descategoriatrabajador, desestadotrabajador, fecingresotrabajador)
VALUES
    ('JUAN PEREZ GOMEZ',        'DEMO-001', 'Operario',      'activo', '2024-01-15'),
    ('MARIA LOPEZ FERNANDEZ',   'DEMO-002', 'Operario',      'activo', '2024-03-01'),
    ('CARLOS RAMIREZ TORRES',   'DEMO-003', 'Ayudante',      'activo', '2024-05-20'),
    ('LUCIA CASTRO VARGAS',     'DEMO-004', 'Supervisor',    'activo', '2023-08-10'),
    ('DIEGO SILVA MENDOZA',     'DEMO-005', 'Operario',      'activo', '2024-02-05')
ON CONFLICT DO NOTHING;
