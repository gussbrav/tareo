import { useState } from 'react'

import { adminApi } from '../api/admin'
import AdminGeneral from '../components/AdminGeneral.jsx'
import AdminMasterTable from '../components/AdminMasterTable.jsx'
import AdminPermisos from '../components/AdminPermisos.jsx'
import AdminSettings from '../components/AdminSettings.jsx'
import AdminSidebar from '../components/admin/AdminSidebar.jsx'
import AdminTrabajadores from '../components/AdminTrabajadores.jsx'
import AdminUsuarios from '../components/AdminUsuarios.jsx'
import { Icon } from '../components/admin/Icons.jsx'

const TABS = [
  { id: 'general',       label: 'General',           group: 'Empresa',   icon: Icon.General },
  { id: 'marca',         label: 'Marca / Config',    group: 'Empresa',   icon: Icon.Brand },
  { id: 'trabajadores',  label: 'Trabajadores',      group: 'Equipo',    icon: Icon.Users },
  { id: 'usuarios',      label: 'Usuarios',          group: 'Equipo',    icon: Icon.Key },
  { id: 'permisos',      label: 'Roles y permisos',  group: 'Equipo',    icon: Icon.Shield },
  { id: 'categorias',    label: 'Categorías',        group: 'Catálogos', icon: Icon.Tag },
  { id: 'areas',         label: 'Áreas',             group: 'Catálogos', icon: Icon.Layers },
  { id: 'especialidades',label: 'Especialidades',    group: 'Catálogos', icon: Icon.Beaker },
  { id: 'centros',       label: 'Centros de costo',  group: 'Catálogos', icon: Icon.Building },
  { id: 'proyectos',     label: 'Proyectos',         group: 'Catálogos', icon: Icon.Folder },
]

// Configs declarativas por master (menos código, cero duplicación).

const areasConfig = {
  api: adminApi.areas,
  title: 'Áreas',
  singular: 'área',
  countLabel: 'áreas',
  searchKeys: ['codarea', 'nbrarea'],
  deleteFlagField: 'flgactivoarea',
  columns: [
    { key: 'codarea',       label: 'Código', sortable: true },
    { key: 'nbrarea',       label: 'Nombre', sortable: true },
    { key: 'flgactivoarea', label: 'Activa', align: 'center', sortable: true },
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
  countLabel: 'especialidades',
  searchKeys: ['codespecialidad', 'nbrespecialidad', 'area_nombre'],
  deleteFlagField: 'flgactivoespecialidad',
  columns: [
    { key: 'area_nombre',           label: 'Área', sortable: true },
    { key: 'codespecialidad',       label: 'Código', sortable: true },
    { key: 'nbrespecialidad',       label: 'Nombre', sortable: true },
    { key: 'flgactivoespecialidad', label: 'Activa', align: 'center', sortable: true },
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
  countLabel: 'centros de costo',
  searchKeys: ['nbrcentrocosto', 'codcentrocosto', 'codigo_ceco', 'especialidad_nombre', 'area_nombre'],
  deleteFlagField: 'flgactivocentrocosto',
  columns: [
    { key: 'area_nombre',          label: 'Área', sortable: true },
    { key: 'especialidad_nombre',  label: 'Especialidad', sortable: true },
    { key: 'codcentrocosto',       label: 'Código', sortable: true },
    { key: 'nbrcentrocosto',       label: 'Nombre', sortable: true },
    { key: 'codigo_ceco',          label: 'CECO', sortable: true },
    { key: 'flgactivocentrocosto', label: 'Activo', align: 'center', sortable: true },
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
  countLabel: 'proyectos',
  searchKeys: ['nbrproyecto', 'descontratoproyecto', 'cliproyecto', 'codproyecto'],
  deleteFlagField: 'flgactivoproyecto',
  columns: [
    { key: 'codproyecto',         label: 'Código', sortable: true },
    { key: 'descontratoproyecto', label: 'Contrato', sortable: true },
    { key: 'nbrproyecto',         label: 'Nombre', sortable: true },
    { key: 'cliproyecto',         label: 'Cliente', sortable: true },
    { key: 'flgactivoproyecto',   label: 'Activo', align: 'center', sortable: true },
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
  countLabel: 'categorías',
  searchKeys: ['codcategoria', 'nbrcategoria'],
  deleteFlagField: 'flgactivocategoria',
  columns: [
    { key: 'codcategoria',       label: 'Código', sortable: true },
    { key: 'nbrcategoria',       label: 'Nombre', sortable: true },
    { key: 'flgactivocategoria', label: 'Activa', align: 'center', sortable: true },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Configuración</h1>
        <p className="text-slate-500 text-sm mt-1">
          Estado del sistema, marca, equipo y catálogos maestros.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <AdminSidebar tabs={TABS} active={tab} onSelect={setTab} />

        <section className="min-w-0">
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
