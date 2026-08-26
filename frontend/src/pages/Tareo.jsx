import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { actividadesApi } from '../api/actividades'
import { today, fmtHM, minutosToHoras } from '../lib/format'
import { useAuthStore } from '../store/auth'
import DateField from '../components/admin/DateField.jsx'
import EditarActividadModal from '../components/EditarActividadModal.jsx'
import { Icon } from '../components/admin/Icons.jsx'
import StatusPill from '../components/admin/StatusPill.jsx'

const stateTone = (estado) =>
  estado === 'finalizado' ? 'emerald' : estado === 'iniciado' ? 'amber' : 'slate'

function initials(name) {
  if (!name) return '??'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function Tareo() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isTrabajador = user?.role === 'trabajador'
  const canEdit = user?.role === 'admin' || user?.role === 'supervisor'
  const canDelete = user?.role === 'admin'

  const [fecha, setFecha] = useState(today())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    actividadesApi
      .listar(fecha)
      .then((data) => {
        setItems(data)
        setSelected(new Set())
      })
      .catch(() => setError('No se pudo cargar el tareo'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [fecha])

  const filtered = useMemo(() => {
    const tokens = filter.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return items
    return items.filter((a) => {
      const haystack = [
        a.trabajador_nombre,
        a.desactividad,
        a.detalle_resumido,
        a.desestadoactividad,
        a.centro_costo_nombre,
      ].map((s) => (s || '').toLowerCase()).join(' | ')
      return tokens.every((t) => haystack.includes(t))
    })
  }, [items, filter])

  const finalizableIds = useMemo(
    () => filtered.filter((a) => a.desestadoactividad === 'iniciado').map((a) => a.id),
    [filtered],
  )

  const toggle = (id) =>
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const toggleAll = () => {
    if (selected.size === finalizableIds.length && finalizableIds.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(finalizableIds))
    }
  }

  const finalizeBatch = async () => {
    setError('')
    setMsg('')
    const ids = Array.from(selected).filter((id) =>
      items.some((a) => a.id === id && a.desestadoactividad === 'iniciado'),
    )
    if (ids.length === 0) {
      setError('Selecciona al menos una actividad iniciada')
      return
    }
    try {
      const res = await actividadesApi.finalizarBatch(ids)
      setMsg(`Se finalizaron ${res.updated} de ${res.requested} actividad(es)`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo finalizar')
    }
  }

  const finalizeOne = async (id) => {
    setError('')
    setMsg('')
    try {
      const res = await actividadesApi.finalizarUna(id)
      if (res.updated > 0) setMsg('Actividad finalizada')
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo finalizar')
    }
  }

  const removeOne = async (a) => {
    if (!confirm(`¿Eliminar la actividad de ${a.trabajador_nombre}?\n"${a.desactividad}"\n\nEsta acción no se puede deshacer.`)) return
    setError('')
    setMsg('')
    try {
      await actividadesApi.eliminar(a.id)
      setMsg('Actividad eliminada')
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo eliminar')
    }
  }

  // ---------- Vista trabajador (mobile-first, minimal) ----------
  if (isTrabajador) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mis tareas</h1>
          <p className="text-slate-500 text-sm mt-1">
            Hola {user?.first_name || 'trabajador'}, estas son tus asignaciones.
          </p>
        </div>

        <div className="card !p-4">
          <label className="label">Fecha</label>
          <DateField value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>

        {error && <Toast tone="error">{error}</Toast>}
        {msg && <Toast tone="success">{msg}</Toast>}

        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <div className="card text-center py-10">
            <div className="mx-auto w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Icon.Inbox className="w-5 h-5" />
            </div>
            <p className="text-sm text-slate-600">No tenés tareas asignadas para esta fecha.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((a) => (
              <li key={a.id} className="card !p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <StatusPill tone={stateTone(a.desestadoactividad)}>
                    {a.desestadoactividad}
                  </StatusPill>
                  <span className="text-xs text-slate-400 shrink-0">{a.fecdia_display}</span>
                </div>
                <p className="text-lg font-medium text-slate-900 leading-snug">{a.desactividad}</p>
                <dl className="text-sm text-slate-500 grid grid-cols-2 gap-y-1">
                  <dt>Inicio</dt>
                  <dd className="text-slate-800 font-medium text-right">{fmtHM(a.horinicio)}</dd>
                  <dt>Fin</dt>
                  <dd className="text-slate-800 font-medium text-right">{fmtHM(a.horfin)}</dd>
                  <dt>Duración</dt>
                  <dd className="text-slate-800 font-medium text-right">{minutosToHoras(a.numduracionminuto)}</dd>
                  {a.centro_costo_nombre && (
                    <>
                      <dt>Centro costo</dt>
                      <dd className="text-slate-800 text-right truncate">{a.centro_costo_nombre}</dd>
                    </>
                  )}
                </dl>
                {a.desestadoactividad === 'iniciado' && (
                  <button onClick={() => finalizeOne(a.id)} className="btn-primary w-full text-base py-3">
                    <Icon.Check className="w-4 h-4" />
                    Finalizar tarea
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // ---------- Vista admin / supervisor ----------
  const allSelected = finalizableIds.length > 0 && selected.size === finalizableIds.length
  const hasSelection = selected.size > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Registro de tareo</h1>
        <p className="text-slate-500 text-sm mt-1">
          {items.length} {items.length === 1 ? 'actividad' : 'actividades'} · {fecha}
        </p>
      </div>

      {/* Filtros */}
      <div className="card !p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Fecha</label>
            <DateField value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Buscar</label>
            <div className="relative">
              <Icon.Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                className="input pl-8"
                placeholder="Buscar por trabajador, actividad, estado o CC…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {finalizableIds.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 -mx-4 px-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                checked={allSelected}
                onChange={toggleAll}
              />
              Seleccionar las {finalizableIds.length} iniciadas
            </label>
            <button
              className="btn-primary btn-sm"
              onClick={finalizeBatch}
              disabled={!hasSelection}
            >
              <Icon.Check className="w-4 h-4" />
              Finalizar{hasSelection ? ` (${selected.size})` : ''}
            </button>
          </div>
        )}

        {error && <Toast tone="error">{error}</Toast>}
        {msg && <Toast tone="success">{msg}</Toast>}
      </div>

      {loading ? (
        <SkeletonList />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Icon.Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-medium text-slate-900">Sin actividades</h3>
          <p className="text-sm text-slate-500 mt-1">
            {filter ? 'No hay resultados para tu búsqueda.' : 'Todavía no hay actividades para esta fecha.'}
          </p>
          {!filter && (
            <button
              className="btn-primary btn-sm mt-4"
              onClick={() => navigate('/actividades/nueva')}
            >
              <Icon.Plus className="w-4 h-4" />
              Nueva actividad
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const canSelect = a.desestadoactividad === 'iniciado'
            const isSelected = selected.has(a.id)
            return (
              <li
                key={a.id}
                className={`card !p-4 flex items-start gap-3 transition-colors ${
                  isSelected ? 'ring-2 ring-brand-500/40 border-brand-300' : ''
                } ${a.desestadoactividad === 'finalizado' ? 'opacity-75' : ''}`}
              >
                <input
                  type="checkbox"
                  className="mt-1.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 disabled:opacity-40"
                  checked={isSelected}
                  onChange={() => toggle(a.id)}
                  disabled={!canSelect}
                  title={canSelect ? 'Seleccionar' : 'Ya finalizada'}
                />
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold shrink-0 mt-0.5">
                  {initials(a.trabajador_nombre)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{a.trabajador_nombre}</p>
                      <p className="text-sm text-slate-700 mt-0.5 break-words">{a.desactividad}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-slate-400 hidden sm:inline">{a.fecdia_display}</span>
                      {canEdit && (
                        <button
                          onClick={() => setEditing(a.id)}
                          className="icon-btn"
                          title="Editar"
                          aria-label="Editar"
                        >
                          <Icon.Edit className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => removeOne(a)}
                          className="icon-btn-danger"
                          title="Eliminar"
                          aria-label="Eliminar"
                        >
                          <Icon.Archive className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StatusPill tone={stateTone(a.desestadoactividad)}>
                      {a.desestadoactividad}
                    </StatusPill>
                    {a.desestadoactividad === 'iniciado' ? (
                      <span className="text-xs text-slate-500 tabular-nums">
                        <span className="text-slate-400">Desde</span> {fmtHM(a.horinicio)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 tabular-nums">
                        {fmtHM(a.horinicio)}
                        {' → '}
                        {fmtHM(a.horfin)}
                        <span className="text-slate-400"> · {minutosToHoras(a.numduracionminuto)}</span>
                      </span>
                    )}
                    {a.centro_costo_nombre && (
                      <span className="text-xs text-slate-500 truncate">
                        <span className="text-slate-400">CC:</span> {a.centro_costo_nombre}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <EditarActividadModal
          actividadId={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
          canDelete={user?.role === 'admin'}
        />
      )}
    </div>
  )
}

function Toast({ tone, children }) {
  const cls = tone === 'error'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
  return (
    <div className={`rounded-md border text-sm px-3 py-2 ${cls}`}>{children}</div>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card !p-4 animate-pulse flex items-start gap-3">
          <div className="w-4 h-4 mt-1 bg-slate-200 rounded" />
          <div className="w-9 h-9 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-3 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
