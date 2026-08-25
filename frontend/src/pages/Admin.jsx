import { useState } from 'react'

import { adminApi } from '../api/admin'
import AdminMasterTable from '../components/AdminMasterTable.jsx'
import AdminTrabajadores from '../components/AdminTrabajadores.jsx'
import AdminUsuarios from '../components/AdminUsuarios.jsx'

const TABS = [
  { id: 'trabajadores', label: 'Trabajadores' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'areas', label: 'Áreas' },
  { id: 'especialidades', label: 'Especialidades' },
  { id: 'centros', label: 'Centros de costo' },
  { id: 'proyectos', label: 'Proyectos' },
]

// Configs declarativas por master (menos código, cero duplicación).

const areasConfig = {
  api: adminApi.areas,
  title: 'Áreas',
  singular: 'área',
  deleteFlagField: 'flgactivoarea',
  columns: [
    { key: 'codarea', label: 'Código' },
    { key: 'nbrarea', label: 'Nombre' },
    { key: 'flgactivoarea', label: 'Activa' },
  ],
  fields: [
    { key: 'codarea', label: 'Código', required: true, placeholder: 'p.ej. 21' },
    { key: 'nbrarea', label: 'Nombre', required: true, placeholder: 'p.ej. Operaciones' },
    { key: 'flgactivoarea', label: 'Activa', type: 'checkbox' },
  ],
  defaults: { codarea: '', nbrarea: '', flgactivoarea: true },
}

const especialidadesConfig = {
  api: adminApi.especialidades,
  title: 'Especialidades',
  singular: 'especialidad',
  deleteFlagField: 'flgactivoespecialidad',
  columns: [
    { key: 'area_nombre', label: 'Área' },
    { key: 'codespecialidad', label: 'Código' },
    { key: 'nbrespecialidad', label: 'Nombre' },
    { key: 'flgactivoespecialidad', label: 'Activa' },
  ],
  fields: [
    {
      key: 'area_id',
      label: 'Área',
      type: 'select',
      required: true,
      optionsAsync: () =>
        adminApi.areas.list().then((rs) =>
          rs.filter((a) => a.flgactivoarea).map((a) => ({ value: a.id, label: `${a.codarea} - ${a.nbrarea}` })),
        ),
    },
    { key: 'codespecialidad', label: 'Código', required: true },
    { key: 'nbrespecialidad', label: 'Nombre', required: true },
    { key: 'flgactivoespecialidad', label: 'Activa', type: 'checkbox' },
  ],
  defaults: { area_id: '', codespecialidad: '', nbrespecialidad: '', flgactivoespecialidad: true },
}

const centrosConfig = {
  api: adminApi.centrosCosto,
  title: 'Centros de costo',
  singular: 'centro de costo',
  deleteFlagField: 'flgactivocentrocosto',
  columns: [
    { key: 'area_nombre', label: 'Área' },
    { key: 'especialidad_nombre', label: 'Especialidad' },
    { key: 'codcentrocosto', label: 'Código' },
    { key: 'nbrcentrocosto', label: 'Nombre' },
    { key: 'codigo_ceco', label: 'CECO' },
    { key: 'flgactivocentrocosto', label: 'Activo' },
  ],
  fields: [
    {
      key: 'especialidad_id',
      label: 'Especialidad',
      type: 'select',
      required: true,
      optionsAsync: () =>
        adminApi.especialidades.list().then((rs) =>
          rs.filter((e) => e.flgactivoespecialidad).map((e) => ({
            value: e.id,
            label: `${e.area_nombre || '?'} → ${e.codespecialidad} ${e.nbrespecialidad}`,
          })),
        ),
    },
    { key: 'codcentrocosto', label: 'Código', required: true },
    { key: 'nbrcentrocosto', label: 'Nombre', required: true },
    { key: 'codigo_ceco', label: 'Código CECO' },
    { key: 'tipocentrocosto', label: 'Tipo (opcional)', placeholder: 'Costo Directo, etc.' },
    { key: 'flgactivocentrocosto', label: 'Activo', type: 'checkbox' },
  ],
  defaults: {
    especialidad_id: '', codcentrocosto: '', nbrcentrocosto: '',
    codigo_ceco: '', tipocentrocosto: '', flgactivocentrocosto: true,
  },
}

const proyectosConfig = {
  api: adminApi.proyectos,
  title: 'Proyectos',
  singular: 'proyecto',
  deleteFlagField: 'flgactivoproyecto',
  columns: [
    { key: 'codproyecto', label: 'Código' },
    { key: 'descontratoproyecto', label: 'Contrato' },
    { key: 'nbrproyecto', label: 'Nombre' },
    { key: 'cliproyecto', label: 'Cliente' },
    { key: 'flgactivoproyecto', label: 'Activo' },
  ],
  fields: [
    { key: 'codproyecto', label: 'Código', type: 'number', required: true },
    { key: 'descontratoproyecto', label: 'Contrato', placeholder: 'p.ej. CONTRATO 2026-410' },
    { key: 'nbrproyecto', label: 'Nombre del proyecto' },
    { key: 'cliproyecto', label: 'Cliente' },
    { key: 'flgactivoproyecto', label: 'Activo', type: 'checkbox' },
  ],
  defaults: {
    codproyecto: 0, descontratoproyecto: '', nbrproyecto: '',
    cliproyecto: '', flgactivoproyecto: true,
  },
}

const categoriasConfig = {
  api: adminApi.categorias,
  title: 'Categorías de trabajador',
  singular: 'categoría',
  deleteFlagField: 'flgactivocategoria',
  columns: [
    { key: 'codcategoria', label: 'Código' },
    { key: 'nbrcategoria', label: 'Nombre' },
    { key: 'flgactivocategoria', label: 'Activa' },
  ],
  fields: [
    { key: 'codcategoria', label: 'Código', required: true, placeholder: 'OPE, SUP, AYU...' },
    { key: 'nbrcategoria', label: 'Nombre', required: true, placeholder: 'Operario, Supervisor...' },
    { key: 'flgactivocategoria', label: 'Activa', type: 'checkbox' },
  ],
  defaults: { codcategoria: '', nbrcategoria: '', flgactivocategoria: true },
}

export default function Admin() {
  const [tab, setTab] = useState('trabajadores')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Administración</h1>
        <p className="text-slate-500 text-sm">Gestión de trabajadores, usuarios y catálogos.</p>
      </div>

      <div className="border-b border-slate-200 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'trabajadores' && <AdminTrabajadores />}
      {tab === 'usuarios' && <AdminUsuarios />}
      {tab === 'categorias' && <AdminMasterTable {...categoriasConfig} />}
      {tab === 'areas' && <AdminMasterTable {...areasConfig} />}
      {tab === 'especialidades' && <AdminMasterTable {...especialidadesConfig} />}
      {tab === 'centros' && <AdminMasterTable {...centrosConfig} />}
      {tab === 'proyectos' && <AdminMasterTable {...proyectosConfig} />}
    </div>
  )
}
