import { useEffect, useMemo, useState } from 'react'

import { adminApi } from '../api/admin'
import { useAuthStore } from '../store/auth'
import AdminCorreo from '../components/AdminCorreo.jsx'
import AdminGeneral from '../components/AdminGeneral.jsx'
import AdminMasterTable from '../components/AdminMasterTable.jsx'
import AdminPermisos from '../components/AdminPermisos.jsx'
import AdminSeguridad from '../components/AdminSeguridad.jsx'
import AdminSettings from '../components/AdminSettings.jsx'
import AdminSidebar from '../components/admin/AdminSidebar.jsx'
import AdminTrabajadores from '../components/AdminTrabajadores.jsx'
import AdminUsuarios from '../components/AdminUsuarios.jsx'
import { Icon } from '../components/admin/Icons.jsx'

const TABS = [
  { id: 'general',       label: 'General',           group: 'Empresa',       icon: Icon.General },
  { id: 'marca',         label: 'Marca / Config',    group: 'Empresa',       icon: Icon.Brand },
  { id: 'trabajadores',  label: 'Trabajadores',      group: 'Equipo',        icon: Icon.Users },
  { id: 'usuarios',      label: 'Usuarios',          group: 'Equipo',        icon: Icon.Key },
  { id: 'permisos',      label: 'Roles y permisos',  group: 'Equipo',        icon: Icon.Shield },
  { id: 'categorias',    label: 'Categorías',        group: 'Catálogos',     icon: Icon.Tag },
  { id: 'proyectos',     label: 'Proyectos',         group: 'Catálogos',     icon: Icon.Folder },
  { id: 'areas',         label: 'Áreas',             group: 'Por proyecto',  icon: Icon.Layers },
  { id: 'especialidades',label: 'Especialidades',    group: 'Por proyecto',  icon: Icon.Beaker },
  { id: 'centros',       label: 'Centros de costo',  group: 'Por proyecto',  icon: Icon.Building },
  { id: 'correo',        label: 'Correo',            group: 'Comunicación',  icon: Icon.General },
  { id: 'seguridad',     label: 'Seguridad',         group: 'Mi cuenta',     icon: Icon.Key },
]

// Tabs cuyo contenido está anclado a un proyecto (usan el selector superior).
const PROYECTO_SCOPED_TABS = new Set(['areas', 'especialidades', 'centros'])

const SCOPE_STORAGE_KEY = 'tareo:admin-scope-proyecto-v1'

// ─── Configs de las tablas maestras ───────────────────────────────────────

const areasConfig = {
  api: adminApi.areas,
  title: 'Áreas',
  singular: 'área',
  countLabel: 'áreas',
  searchKeys: ['codarea', 'nbrarea'],
  deleteFlagField: 'flgactivoarea',
  injectProyectoAs: 'proyecto_id',
  showCecoImporter: true,
  showCecoExport: true,
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
  showCecoExport: true,
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
      // optionsAsync recibe scopeProyectoId como argumento — filtra las
      // áreas al proyecto activo para que no aparezcan áreas de otros.
      optionsAsync: (proyectoId) =>
        adminApi.areas.list(proyectoId ? { proyecto_id: proyectoId } : {}).then((rs) =>
          rs.filter((a) => a.flgactivoarea).map((a) => ({
            value: a.id, label: `${a.codarea} - ${a.nbrarea}`,
          })),
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
  showCecoExport: true,
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
      optionsAsync: (proyectoId) =>
        adminApi.especialidades.list(proyectoId ? { proyecto_id: proyectoId } : {}).then((rs) =>
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
  // Cada mutación dispara el evento — el ProyectoScopeBar de los tabs
  // por-proyecto lo escucha y refetch la lista de proyectos activos.
  // Sin esto, un proyecto recién creado no aparecía en el dropdown de Áreas.
  notifyEvent: 'tareo:proyectos-updated',
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

// ─── Selector de proyecto activo (persistido) ─────────────────────────────

function ProyectoScopeBar({ proyectos, value, onChange }) {
  const activo = proyectos.find((p) => p.id === value)
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-brand-50/60 border border-brand-100 rounded-xl">
      <div className="flex items-center gap-2 min-w-0">
        <Icon.Folder className="w-4 h-4 text-brand-600 shrink-0" />
        <span className="text-sm font-medium text-slate-800 shrink-0">Proyecto activo:</span>
      </div>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="input input-sm flex-1 min-w-[220px] max-w-[420px]"
      >
        <option value="">— Elige un proyecto —</option>
        {proyectos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.descontratoproyecto ? `${p.descontratoproyecto} · ` : ''}
            {p.nbrproyecto || `Proyecto ${p.codproyecto}`}
            {p.cliproyecto ? ` (${p.cliproyecto})` : ''}
          </option>
        ))}
      </select>
      {activo && (
        <span className="text-xs text-slate-500 shrink-0">
          Todas las áreas, especialidades y CC de esta sección corresponden a este proyecto.
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// Tabs que solo puede ver un admin. Non-admin (supervisor/trabajador) solo
// ven "Mi cuenta > Seguridad" para gestionar su propia contraseña.
const ADMIN_ONLY_TABS = new Set([
  'general', 'marca', 'trabajadores', 'usuarios', 'permisos',
  'categorias', 'proyectos', 'areas', 'especialidades', 'centros', 'correo',
])

export default function Admin() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  // Tabs visibles según rol. Non-admin: solo "seguridad" (Mi cuenta).
  const visibleTabs = useMemo(
    () => (isAdmin ? TABS : TABS.filter((t) => !ADMIN_ONLY_TABS.has(t.id))),
    [isAdmin],
  )

  const [tab, setTab] = useState(() => (isAdmin ? 'general' : 'seguridad'))
  const [proyectos, setProyectos] = useState([])
  const [scopeProyectoId, setScopeProyectoIdState] = useState(
    () => localStorage.getItem(SCOPE_STORAGE_KEY) || null,
  )

  const setScopeProyectoId = (id) => {
    setScopeProyectoIdState(id)
    if (id) localStorage.setItem(SCOPE_STORAGE_KEY, id)
    else localStorage.removeItem(SCOPE_STORAGE_KEY)
  }

  // Carga la lista de proyectos activos (para el selector).
  // Reacciona al evento "tareo:proyectos-updated" que dispara el CRUD de
  // Proyectos cuando se crea/edita/elimina uno — así el dropdown de los
  // tabs por-proyecto (Áreas / Especialidades / CC) siempre refleja la
  // realidad sin necesitar F5.
  useEffect(() => {
    const load = () =>
      adminApi.proyectos.list()
        .then((rs) => {
          const activos = rs.filter((p) => p.flgactivoproyecto)
          setProyectos(activos)
          setScopeProyectoIdState((prev) => {
            if (prev && activos.some((p) => p.id === prev)) return prev
            const first = activos[0]?.id || null
            if (first) localStorage.setItem(SCOPE_STORAGE_KEY, first)
            return first
          })
        })
        .catch(() => {})
    load()
    window.addEventListener('tareo:proyectos-updated', load)
    return () => window.removeEventListener('tareo:proyectos-updated', load)
  }, [])

  const proyectoActivo = useMemo(
    () => proyectos.find((p) => p.id === scopeProyectoId) || null,
    [proyectos, scopeProyectoId],
  )

  const isScopedTab = PROYECTO_SCOPED_TABS.has(tab)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Configuración</h1>
        <p className="text-slate-500 text-sm mt-1">
          Estado del sistema, marca, equipo y catálogos maestros.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <AdminSidebar tabs={visibleTabs} active={tab} onSelect={setTab} />

        <section className="min-w-0 space-y-4">
          {/* Selector de proyecto: sólo visible en tabs por-proyecto */}
          {isScopedTab && proyectos.length > 0 && (
            <ProyectoScopeBar
              proyectos={proyectos}
              value={scopeProyectoId}
              onChange={setScopeProyectoId}
            />
          )}

          {tab === 'general' && <AdminGeneral />}
          {tab === 'marca' && <AdminSettings />}
          {tab === 'trabajadores' && <AdminTrabajadores />}
          {tab === 'usuarios' && <AdminUsuarios />}
          {tab === 'permisos' && <AdminPermisos />}
          {tab === 'categorias' && <AdminMasterTable {...categoriasConfig} />}
          {tab === 'proyectos' && <AdminMasterTable {...proyectosConfig} />}
          {tab === 'areas' && (
            <AdminMasterTable
              {...areasConfig}
              scopeProyectoId={scopeProyectoId}
              proyectoActivo={proyectoActivo}
              optionsAsyncArgs={[scopeProyectoId]}
            />
          )}
          {tab === 'especialidades' && (
            <AdminMasterTable
              {...especialidadesConfig}
              scopeProyectoId={scopeProyectoId}
              proyectoActivo={proyectoActivo}
              optionsAsyncArgs={[scopeProyectoId]}
            />
          )}
          {tab === 'centros' && (
            <AdminMasterTable
              {...centrosConfig}
              scopeProyectoId={scopeProyectoId}
              proyectoActivo={proyectoActivo}
              optionsAsyncArgs={[scopeProyectoId]}
            />
          )}
          {tab === 'correo' && <AdminCorreo />}
          {tab === 'seguridad' && <AdminSeguridad />}
        </section>
      </div>
    </div>
  )
}
