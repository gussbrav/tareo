import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { actividadesApi } from '../api/actividades'
import { today, fmtHM, minutosToHoras } from '../lib/format'
import { useAuthStore } from '../store/auth'
import DateField from '../components/admin/DateField.jsx'
import EditarActividadModal from '../components/EditarActividadModal.jsx'

const estadoStyles = {
  iniciado: 'bg-amber-50 text-amber-800 border-amber-200',
  finalizado: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

export default function Tareo() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isTrabajador = user?.role === 'trabajador'
  const canEdit = user?.role === 'admin' || user?.role === 'supervisor'

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
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (a) =>
        (a.trabajador_nombre || '').toLowerCase().includes(q) ||
        (a.desactividad || '').toLowerCase().includes(q) ||
        (a.detalle_resumido || '').toLowerCase().includes(q),
    )
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

  // ---------- Vista trabajador (UI simplificada) ----------
  if (isTrabajador) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mis tareas</h1>
          <p className="text-slate-500 text-sm">
            Hola {user?.first_name || 'trabajador'}, estas son tus asignaciones.
          </p>
        </div>

        <div className="card">
          <label className="label">Fecha</label>
          <DateField value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>

        {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
        {msg && <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{msg}</div>}

        {loading ? (
          <p className="text-slate-500 text-sm">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="card text-slate-500 text-sm text-center">
            No tienes tareas asignadas para esta fecha.
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((a) => (
              <li key={a.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${estadoStyles[a.desestadoactividad] || ''}`}>
                      {a.desestadoactividad}
                    </span>
                    <p className="mt-2 text-lg font-medium text-slate-900">{a.desactividad}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{a.fecdia_display}</span>
                </div>
                <div className="text-sm text-slate-500 space-y-0.5">
                  <div>Inicio: <span className="text-slate-800 font-medium">{fmtHM(a.horinicio)}</span></div>
                  <div>Fin: <span className="text-slate-800 font-medium">{fmtHM(a.horfin)}</span> · Duración: {minutosToHoras(a.numduracionminuto)}</div>
                  {a.centro_costo_nombre && <div>Centro costo: {a.centro_costo_nombre}</div>}
                </div>
                {a.desestadoactividad === 'iniciado' && (
                  <button onClick={() => finalizeOne(a.id)} className="btn-primary w-full text-base py-3">
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
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">
          Registro de tareo <span className="text-slate-400 text-base font-normal">· {items.length} actividad(es)</span>
        </h1>
        <button className="btn-primary" onClick={() => navigate('/actividades/nueva')}>
          + Nueva actividad
        </button>
      </div>

      <div className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Fecha</label>
            <DateField value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Filtrar</label>
            <input
              className="input"
              placeholder="Buscar por trabajador, descripción o estado…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded text-brand-600 focus:ring-brand-500"
              checked={selected.size > 0 && selected.size === finalizableIds.length}
              onChange={toggleAll}
              disabled={finalizableIds.length === 0}
            />
            Seleccionar todas las iniciadas
          </label>
          <button className="btn-primary" onClick={finalizeBatch} disabled={selected.size === 0}>
            Finalizar {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>

        {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
        {msg && <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{msg}</div>}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="card text-slate-500 text-sm text-center">
          Sin actividades para esta fecha. Crea una nueva desde el botón de arriba.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const canSelect = a.desestadoactividad === 'iniciado'
            return (
              <li
                key={a.id}
                className={`rounded-xl border shadow-card p-4 flex items-start gap-3 bg-white ${
                  a.desestadoactividad === 'finalizado' ? 'opacity-90' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 rounded text-brand-600 focus:ring-brand-500"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                  disabled={!canSelect}
                  title={canSelect ? 'Seleccionar' : 'Ya finalizada'}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900 truncate">{a.trabajador_nombre}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">{a.fecdia_display}</span>
                      {canEdit && (
                        <button
                          onClick={() => setEditing(a.id)}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                          title="Editar / Mantenimiento"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 mt-1 break-words">{a.desactividad}</p>
                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${estadoStyles[a.desestadoactividad] || ''}`}>
                      {a.desestadoactividad}
                    </span>
                    <span className="text-xs text-slate-500">
                      Inicio {fmtHM(a.horinicio)} · Fin {fmtHM(a.horfin)} · {minutosToHoras(a.numduracionminuto)}
                    </span>
                    {a.centro_costo_nombre && (
                      <span className="text-xs text-slate-500 truncate">Centro de Costo: {a.centro_costo_nombre}</span>
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
