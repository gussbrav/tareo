import { useState } from 'react'

import { adminApi } from '../api/admin'
import AdminGeneral from '../components/AdminGeneral.jsx'
import AdminMasterTable from '../components/AdminMasterTable.jsx'
import AdminPermisos from '../components/AdminPermisos.jsx'
import AdminSettings from '../components/AdminSettings.jsx'
import AdminTrabajadores from '../components/AdminTrabajadores.jsx'
import AdminUsuarios from '../components/AdminUsuarios.jsx'

const TABS = [
  { id: 'general', label: 'General', group: 'Empresa' },
  { id: 'marca', label: 'Marca / Config', group: 'Empresa' },
  { id: 'trabajadores', label: 'Trabajadores', group: 'Equipo' },
  { id: 'usuarios', label: 'Usuarios', group: 'Equipo' },
  { id: 'permisos', label: 'Roles y permisos', group: 'Equipo' },
  { id: 'categorias', label: 'Categorías', group: 'Catálogos' },
  { id: 'areas', label: 'Áreas', group: 'Catálogos' },
  { id: 'especialidades', label: 'Especialidades', group: 'Catálogos' },
  { id: 'centros', label: 'Centros de costo', group: 'Catálogos' },
  { id: 'proyectos', label: 'Proyectos', group: 'Catálogos' },
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
  const [tab, setTab] = useState('general')

  // Agrupar tabs por sección (sidebar-like) para claridad
  const groups = TABS.reduce((acc, t) => {
    acc[t.group] = acc[t.group] || []
    acc[t.group].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
        <p className="text-slate-500 text-sm">
          Estado del sistema, marca, equipo y catálogos maestros.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
        <aside className="space-y-4">
          {Object.entries(groups).map(([groupName, ts]) => (
            <div key={groupName}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-3 mb-1">
                {groupName}
              </div>
              <div className="space-y-0.5">
                {ts.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                      tab === t.id
                        ? 'bg-brand-600 text-white font-medium'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <section>
          {tab === 'general' && <AdminGeneral />}
          {tab === 'marca' && <AdminSettings />}
          {tab === 'trabajadores' && <AdminTrabajadores />}
          {tab === 'usuarios' && <AdminUsuarios />}
          {tab === 'permisos' && <AdminPermisos />}
          {tab === 'categorias' && <AdminMasterTable {...categoriasConfig} />}
          {tab === 'areas' && <AdminMasterTable {...areasConfig} />}
          {tab === 'especialidades' && <AdminMasterTable {...especialidadesConfig} />}
          {tab === 'centros' && <AdminMasterTable {...centrosConfig} />}
          {tab === 'proyectos' && <AdminMasterTable {...proyectosConfig} />}
        </section>
      </div>
    </div>
  )
}
