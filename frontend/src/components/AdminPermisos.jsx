/**
 * Matriz de permisos por rol — EDITABLE. Guarda cambios en auth.role_permissions
 * del backend. Sin hardcode: la data viene y se persiste 100% desde la DB.
 */
import { useEffect, useMemo, useState } from 'react'

import { configApi } from '../api/config'

const ROLES = [
  { key: 'admin', label: 'Admin', tone: 'bg-red-50 text-red-700 border-red-200' },
  { key: 'supervisor', label: 'Supervisor', tone: 'bg-brand-50 text-brand-700 border-brand-200' },
  { key: 'trabajador', label: 'Trabajador', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
]

// Mapa de labels amigables para keys conocidas. Cualquier key no listada usa
// el key formateado (raw).
const KEY_LABELS = {
  'auth.login':                'Iniciar sesión',
  'tareo.ver_todos':           'Ver actividades de todo el equipo',
  'tareo.ver_propias':         'Ver mis actividades',
  'actividades.crear':         'Crear nueva actividad',
  'actividades.editar':        'Editar actividad (Mantenimiento)',
  'actividades.eliminar':      'Eliminar actividad',
  'actividades.finalizar':     'Finalizar actividad',
  'reportes.dashboard':        'Ver Dashboard con KPIs',
  'reportes.export_excel':     'Exportar Excel',
  'admin.acceso':              'Acceso al panel Administración',
  'admin.trabajadores':        'CRUD de trabajadores',
  'admin.usuarios':            'CRUD de usuarios',
  'admin.catalogos':           'CRUD de categorías/áreas/centros de costo/proyectos',
  'admin.permisos':            'Editar permisos por rol',
  'admin.settings':            'Editar configuración/marca',
}

const GROUP_OF = (key) => {
  const [g] = key.split('.')
  return {
    auth: 'Autenticación',
    tareo: 'Tareo',
    actividades: 'Actividades',
    reportes: 'Reportes',
    admin: 'Administración',
  }[g] || g.charAt(0).toUpperCase() + g.slice(1)
}

function Toggle({ checked, onChange, disabled, savingKey }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 ${
        checked ? 'bg-brand-600' : 'bg-slate-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
      {savingKey && (
        <span className="absolute -right-6 text-xs text-slate-400 animate-pulse">…</span>
      )}
    </button>
  )
}

export default function AdminPermisos() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null) // "role:key" del toggle en vuelo
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    configApi.permissions
      .matrix()
      .then(setRows)
      .catch(() => setError('No se pudo cargar la matriz'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Reagrupar: { permission_key: { role: allowed } }
  const matrix = useMemo(() => {
    const m = {}
    for (const r of rows) {
      m[r.permission_key] = m[r.permission_key] || {}
      m[r.permission_key][r.role] = r.allowed
    }
    return m
  }, [rows])

  const grouped = useMemo(() => {
    const g = {}
    for (const key of Object.keys(matrix)) {
      const groupName = GROUP_OF(key)
      g[groupName] = g[groupName] || []
      g[groupName].push(key)
    }
    // sort each group by label
    for (const gname of Object.keys(g)) {
      g[gname].sort((a, b) => (KEY_LABELS[a] || a).localeCompare(KEY_LABELS[b] || b))
    }
    return g
  }, [matrix])

  const handleToggle = async (role, permission_key, allowed) => {
    setError('')
    setMsg('')
    const saveKey = `${role}:${permission_key}`
    setSaving(saveKey)
    // Optimistic update
    setRows((prev) =>
      prev.map((r) =>
        r.role === role && r.permission_key === permission_key ? { ...r, allowed } : r,
      ),
    )
    try {
      await configApi.permissions.toggle(role, permission_key, allowed)
      setMsg('Cambios guardados')
      setTimeout(() => setMsg(''), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar')
      // Rollback
      load()
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <p className="text-slate-500 text-sm">Cargando matriz…</p>

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-1">Roles y permisos</h2>
        <p className="text-sm text-slate-500">
          Los cambios se aplican en tiempo real. El backend recibe cada toggle y actualiza la
          matriz en <code className="text-xs bg-slate-100 px-1 rounded">auth.role_permissions</code>.
          Nada está hardcodeado — podés desactivar una capability para un rol y su UI + endpoint
          responderán 403 al instante (con TTL de cache de 60s).
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {ROLES.map((r) => (
            <span key={r.key} className={`text-xs px-3 py-1 rounded-full border ${r.tone}`}>
              {r.label}
            </span>
          ))}
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
      {msg && <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{msg}</div>}

      {Object.keys(grouped).sort().map((groupName) => (
        <div key={groupName} className="card overflow-x-auto">
          <h3 className="text-sm font-semibold text-brand-700 uppercase tracking-wide mb-3">{groupName}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Capacidad</th>
                {ROLES.map((r) => (
                  <th key={r.key} className="py-2 px-2 text-center w-28">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grouped[groupName].map((key) => (
                <tr key={key}>
                  <td className="py-3 pr-3">
                    <div className="text-slate-800">{KEY_LABELS[key] || key}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      <code>{key}</code>
                    </div>
                  </td>
                  {ROLES.map((r) => {
                    const allowed = !!matrix[key]?.[r.key]
                    const saveKey = `${r.key}:${key}`
                    return (
                      <td key={r.key} className="py-3 px-2 text-center">
                        <div className="inline-block relative">
                          <Toggle
                            checked={allowed}
                            onChange={(v) => handleToggle(r.key, key, v)}
                            disabled={saving === saveKey}
                            savingKey={saving === saveKey}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="card bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
        <p><strong>Cómo funciona:</strong> el backend cachea la matriz por 60s. Un cambio acá
          invalida el cache al instante. Al siguiente request, el guard <code>require_permission()</code>
          consulta la matriz actualizada.</p>
        <p><strong>Encoding en UI:</strong> las páginas usan <code>/api/config/my-permissions</code> al login
          para saber qué renderizar. Si desactivás una capability para un rol, ese usuario debe hacer
          logout/login para que la UI se actualice.</p>
      </div>
    </div>
  )
}
