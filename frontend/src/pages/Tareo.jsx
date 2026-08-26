import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { actividadesApi } from '../api/actividades'
import { today, fmtHM, minutosToHoras } from '../lib/format'
import { useAuthStore } from '../store/auth'
import ConfirmDialog from '../components/admin/ConfirmDialog.jsx'
import DateField from '../components/admin/DateField.jsx'
import EditarActividadModal from '../components/EditarActividadModal.jsx'
import { Icon } from '../components/admin/Icons.jsx'
import StatusPill from '../components/admin/StatusPill.jsx'

const PAGE_SIZE = 50

// Convención de monitoreo (consistente con Agenda):
//   iniciado  → emerald (activo, en curso — como los indicadores online)
//   finalizado → slate  (histórico, no requiere atención)
const stateTone = (estado) =>
  estado === 'iniciado' ? 'emerald' : estado === 'finalizado' ? 'slate' : 'slate'

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
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  // Búsqueda con debounce → parámetro efectivo que se manda al server
  const [qDebounced, setQDebounced] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [editing, setEditing] = useState(null)
  const [deletingActivity, setDeletingActivity] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Debounce del buscador: espera 400ms tras la última tecla antes de disparar
  // la request. Al cambiar la búsqueda, volver a página 1.
  const debounceRef = useRef(null)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQDebounced(filter)
      setPage(1)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [filter])

  // Al cambiar de fecha, resetear a página 1 (sin esto quedarías en página N
  // inexistente de otra fecha).
  useEffect(() => {
    setPage(1)
  }, [fecha])

  const load = () => {
    setLoading(true)
    setError('')
    actividadesApi
      .listar(fecha, { q: qDebounced, page, size: PAGE_SIZE })
      .then((data) => {
        setItems(data.items || [])
        setTotal(data.total || 0)
        setPages(data.pages || 0)
      })
      .catch(() => setError('No se pudo cargar el tareo'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [fecha, qDebounced, page])

  // Selección "seleccionar todas las iniciadas" opera sobre la página visible.
  // Cross-page selection persiste en `selected` (Set de IDs) al navegar.
  const finalizableIds = useMemo(
    () => items.filter((a) => a.desestadoactividad === 'iniciado').map((a) => a.id),
    [items],
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

  const removeOne = (a) => setDeletingActivity(a)

  const doDelete = async () => {
    if (!deletingActivity) return
    setError('')
    setMsg('')
    await actividadesApi.eliminar(deletingActivity.id)
    setMsg('Actividad eliminada')
    load()
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
        ) : items.length === 0 ? (
          <div className="card text-center py-10">
            <div className="mx-auto w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Icon.Inbox className="w-5 h-5" />
            </div>
            <p className="text-sm text-slate-600">No tienes tareas asignadas para esta fecha.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
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
          {total} {total === 1 ? 'actividad' : 'actividades'} · {fecha}
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
              Seleccionar las {finalizableIds.length} iniciadas de esta página
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
      ) : items.length === 0 ? (
        <div className="card text-center py-12">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Icon.Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-medium text-slate-900">Sin actividades</h3>
          <p className="text-sm text-slate-500 mt-1">
            {qDebounced ? 'No hay resultados para tu búsqueda.' : 'Todavía no hay actividades para esta fecha.'}
          </p>
          {!qDebounced && (
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
          {items.map((a) => {
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

      {pages > 1 && (
        <Paginator
          page={page}
          pages={pages}
          total={total}
          size={PAGE_SIZE}
          onPageChange={setPage}
          disabled={loading}
        />
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

      <ConfirmDialog
        open={!!deletingActivity}
        onClose={() => setDeletingActivity(null)}
        onConfirm={doDelete}
        title="Eliminar actividad"
        message={
          <>
            ¿Seguro que querés eliminar la actividad de{' '}
            <strong className="text-slate-900">{deletingActivity?.trabajador_nombre}</strong>?
            <br />
            <span className="italic text-slate-600">"{deletingActivity?.desactividad}"</span>
            <br />
            <span className="text-red-600 text-xs mt-2 inline-block">
              Esta acción no se puede deshacer.
            </span>
          </>
        }
        confirmLabel="Eliminar"
      />
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

function Paginator({ page, pages, total, size, onPageChange, disabled }) {
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(page * size, total)
  const canPrev = page > 1 && !disabled
  const canNext = page < pages && !disabled
  return (
    <div className="flex items-center justify-between text-sm text-slate-600 pt-1">
      <span className="tabular-nums">
        Mostrando <strong className="text-slate-900">{from}–{to}</strong> de{' '}
        <strong className="text-slate-900">{total}</strong>
      </span>
      <div className="flex items-center gap-1">
        <button
          className="btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          aria-label="Página anterior"
        >
          ← Anterior
        </button>
        <span className="px-3 text-xs text-slate-500 tabular-nums">
          Página {page} de {pages}
        </span>
        <button
          className="btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          aria-label="Página siguiente"
        >
          Siguiente →
        </button>
      </div>
    </div>
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
