/**
 * Agenda — Vista calendaria de actividades (Google Calendar / CRM Palma style).
 *
 * Vistas: Mes (grilla), Semana (7 columnas), Lista (flat por día).
 * Read-only para trabajador; admin/supervisor pueden abrir editar-modal.
 *
 * Colores (convención de monitoreo — "qué está pasando ahora"):
 *   - iniciado  → verde (activo, en curso — como los indicadores online)
 *   - finalizado → slate/muted (histórico, no requiere atención)
 *   Esto es opuesto al patrón Linear/Jira (donde green = done), pero
 *   para una vista de agenda operativa lo que importa es lo activo.
 *
 * Polling silencioso 20s + refresh al volver a la pestaña.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { actividadesApi } from '../api/actividades'
import { adminApi } from '../api/admin'
import EditarActividadModal from '../components/EditarActividadModal.jsx'
import { Icon } from '../components/admin/Icons.jsx'
import StatusPill from '../components/admin/StatusPill.jsx'
import { useAuthStore } from '../store/auth'
import { fmtHM, minutosToHoras } from '../lib/format'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// Convención de monitoreo: verde = activo (en curso), slate = histórico (finalizado).
// Para StatusPill (que ya existe en la app), mapeamos:
//   iniciado  → emerald  (pill verde con dot verde)
//   finalizado → slate    (pill gris con dot gris)
const ESTADO_STYLE = {
  iniciado:   { bg: 'bg-emerald-500', text: 'text-white', tone: 'emerald' },
  finalizado: { bg: 'bg-slate-400',   text: 'text-white', tone: 'slate' },
}
const getEstadoStyle = (estado) =>
  ESTADO_STYLE[(estado || '').toLowerCase()] || { bg: 'bg-slate-300', text: 'text-white', tone: 'slate' }

function getLocalToday() {
  const d = new Date()
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    iso: isoOf(d),
  }
}

function isoOf(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** 7 fechas de la semana de `date`, empezando por Lunes. */
function weekOf(date) {
  const d = new Date(date)
  const dow = d.getDay() // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day
  })
}

function buildMonthCells(year, month) {
  const firstDay = new Date(year, month - 1, 1)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month, 0).getDate()
  const prevDays = new Date(year, month - 1, 0).getDate()
  const cells = []
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, current: false, key: `prev-${i}` })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, current: true, key: iso, iso })
  }
  let next = 1
  while (cells.length % 7 !== 0) {
    cells.push({ day: next++, current: false, key: `next-${next}` })
  }
  return cells
}

/** Pill compacto usado en la grilla mensual. */
function ActividadPill({ actividad, groupBy, onOpen }) {
  const { bg, text } = getEstadoStyle(actividad.desestadoactividad)
  const hora = fmtHM(actividad.horinicio)
  const label = groupBy === 'actividad'
    ? (actividad.desactividad || 'Sin descripción')
    : actividad.trabajador_nombre
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen?.(actividad) }}
      className={`block w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate
                  transition-all cursor-pointer hover:brightness-110 hover:shadow-sm
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                  focus-visible:ring-offset-1 focus-visible:ring-offset-brand-500
                  ${bg} ${text}`}
      title={`${actividad.trabajador_nombre} · ${actividad.desactividad || ''}`}
    >
      <div className="flex items-center gap-1 truncate">
        {hora && <span className="opacity-75 shrink-0 tabular-nums">{hora}</span>}
        <span className="truncate">{label}</span>
      </div>
    </button>
  )
}

/** Card usado en week view y day panel. */
function ActividadCard({ actividad, groupBy, onOpen }) {
  const { tone } = getEstadoStyle(actividad.desestadoactividad)
  const primary = groupBy === 'actividad'
    ? (actividad.desactividad || 'Sin descripción')
    : actividad.trabajador_nombre
  const secondary = groupBy === 'actividad'
    ? actividad.trabajador_nombre
    : actividad.desactividad
  return (
    <button
      type="button"
      onClick={() => onOpen?.(actividad)}
      className="w-full text-left border border-slate-200 rounded-lg p-2.5 space-y-1
                 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <StatusPill tone={tone}>{actividad.desestadoactividad}</StatusPill>
        <span className="text-[11px] font-mono tabular-nums text-slate-500">
          {fmtHM(actividad.horinicio)}{actividad.horfin ? ` → ${fmtHM(actividad.horfin)}` : ''}
        </span>
      </div>
      <div className="text-sm font-medium text-slate-900 line-clamp-1">{primary}</div>
      {secondary && (
        <p className="text-xs text-slate-600 line-clamp-2">{secondary}</p>
      )}
      {actividad.centro_costo_nombre && (
        <p className="text-[11px] text-slate-500 truncate">
          <span className="text-slate-400">CC:</span> {actividad.centro_costo_nombre}
        </p>
      )}
    </button>
  )
}

/** ── VIEW: Mes ─────────────────────────────────────────────────────── */
function MonthView({ year, month, actsByDay, selectedDay, setSelectedDay, today, groupBy, onOpen }) {
  const cells = useMemo(() => buildMonthCells(year, month), [year, month])
  return (
    <div className="card-flush">
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DIAS.map((d) => (
          <div key={d} className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const isToday = cell.current && cell.iso === today.iso
          const isSelected = cell.current && cell.iso === selectedDay
          const dayActs = cell.iso ? (actsByDay[cell.iso] || []) : []
          const extras = dayActs.length > 3 ? dayActs.length - 3 : 0
          const borders = idx % 7 !== 0 ? 'border-l border-slate-100' : ''
          return (
            <div
              key={cell.key}
              onClick={() => cell.current && setSelectedDay(isSelected ? null : cell.iso)}
              className={`min-h-[96px] p-1.5 flex flex-col gap-1 border-b border-slate-100 ${borders}
                          ${cell.current ? 'cursor-pointer hover:bg-slate-50/60' : 'bg-slate-50/40 cursor-default'}
                          ${isSelected ? 'bg-brand-50/60 hover:bg-brand-50/60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold
                                  ${isToday ? 'bg-brand-600 text-white' : ''}
                                  ${!isToday && cell.current ? 'text-slate-700' : ''}
                                  ${!cell.current ? 'text-slate-300' : ''}
                                  ${isSelected && !isToday ? 'text-brand-700' : ''}`}>
                  {cell.day}
                </span>
                {dayActs.length > 0 && (
                  <span className="text-[9px] font-bold text-brand-700 bg-brand-50 px-1.5 rounded-full tabular-nums">
                    {dayActs.length}
                  </span>
                )}
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                {dayActs.slice(0, 3).map((a) => (
                  <ActividadPill key={a.id} actividad={a} groupBy={groupBy} onOpen={onOpen} />
                ))}
                {extras > 0 && (
                  <div className="text-[10px] text-slate-400 font-medium pl-1 hover:text-brand-600 hover:underline transition-colors">
                    +{extras} más
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** ── VIEW: Semana ──────────────────────────────────────────────────── */
function WeekView({ anchor, actsByDay, today, groupBy, onOpen }) {
  const week = useMemo(() => weekOf(new Date(anchor + 'T12:00:00')), [anchor])
  return (
    <div className="card-flush overflow-x-auto">
      <div className="grid grid-cols-7 border-b border-slate-100 min-w-[720px]">
        {week.map((d) => {
          const iso = isoOf(d)
          const isToday = iso === today.iso
          return (
            <div key={iso} className="py-2.5 px-2 text-center border-l border-slate-100 first:border-l-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {DIAS[d.getDay() === 0 ? 6 : d.getDay() - 1]}
              </div>
              <div className={`mt-0.5 inline-flex w-7 h-7 items-center justify-center rounded-full text-sm font-semibold
                                ${isToday ? 'bg-brand-600 text-white' : 'text-slate-700'}`}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-7 min-w-[720px]">
        {week.map((d, idx) => {
          const iso = isoOf(d)
          const dayActs = actsByDay[iso] || []
          const borders = idx > 0 ? 'border-l border-slate-100' : ''
          return (
            <div key={iso} className={`min-h-[420px] p-2 space-y-1.5 ${borders}`}>
              {dayActs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-300">
                  —
                </div>
              ) : (
                dayActs.map((a) => (
                  <ActividadCard key={a.id} actividad={a} groupBy={groupBy} onOpen={onOpen} />
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** ── VIEW: Lista ───────────────────────────────────────────────────── */
function ListView({ actsByDay, groupBy, onOpen }) {
  const days = Object.keys(actsByDay).sort()
  if (days.length === 0) {
    return (
      <div className="card-flush">
        <div className="text-center py-14 px-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Icon.Calendar className="w-6 h-6" />
          </div>
          <p className="mt-3 text-sm text-slate-600">Sin actividades en este período.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="card-flush divide-y divide-slate-100">
      {days.map((iso) => {
        const [y, m, d] = iso.split('-').map(Number)
        const dateObj = new Date(y, m - 1, d)
        const dow = dateObj.getDay()
        const dowLabel = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][dow]
        const acts = actsByDay[iso]
        return (
          <div key={iso}>
            <div className="px-4 py-2 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {d} {MESES[m - 1]}
                </span>
                <span className="text-xs text-slate-500">{dowLabel}</span>
              </div>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {acts.length} {acts.length === 1 ? 'actividad' : 'actividades'}
              </span>
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {acts.map((a) => (
                <ActividadCard key={a.id} actividad={a} groupBy={groupBy} onOpen={onOpen} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** ── Panel lateral (día seleccionado, solo vista Mes) ──────────────── */
function DayPanel({ date, actividades, groupBy, onClose, onOpen }) {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  const label = `${d} de ${MESES[m - 1]} ${y}`
  return (
    <div className="w-80 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-card flex flex-col overflow-hidden max-h-[80vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Icon.Calendar className="w-4 h-4 text-brand-600" />
          <span className="text-sm font-semibold text-slate-800">{label}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
          <Icon.X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {actividades.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Sin actividades este día</p>
        ) : (
          actividades.map((a) => (
            <ActividadCard key={a.id} actividad={a} groupBy={groupBy} onOpen={onOpen} />
          ))
        )}
      </div>
    </div>
  )
}

/** ── Segmented control genérico ────────────────────────────────────── */
function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-slate-100/70 rounded-lg">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all inline-flex items-center gap-1.5
                      ${value === o.value ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {o.icon && <o.icon className="w-3.5 h-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Agenda() {
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'supervisor'

  const today = getLocalToday()
  const [view, setView] = useState('mes')          // 'mes' | 'semana' | 'lista'
  const [groupBy, setGroupBy] = useState('trabajador') // 'trabajador' | 'actividad'
  const [anchor, setAnchor] = useState(today.iso) // día de anclaje (mueve mes/semana)
  const [actividades, setActividades] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [filterTrabajador, setFilterTrabajador] = useState('')
  const [filterProyecto, setFilterProyecto] = useState('')
  const [trabajadoresCat, setTrabajadoresCat] = useState([])
  const [proyectosCat, setProyectosCat] = useState([])
  const [editingId, setEditingId] = useState(null)

  const year = Number(anchor.slice(0, 4))
  const month = Number(anchor.slice(5, 7))
  const mes = `${year}-${String(month).padStart(2, '0')}`

  useEffect(() => {
    if (!canManage) return
    adminApi.trabajadores.list()
      .then((rs) => setTrabajadoresCat(rs.filter((t) => t.flgativotrabajador)))
      .catch(() => {})
    adminApi.proyectos.list()
      .then((rs) => setProyectosCat(rs.filter((p) => p.flgactivoproyecto)))
      .catch(() => {})
  }, [canManage])

  const fetchedRef = useRef(false)
  const fetchActividades = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    const filtros = {}
    if (filterTrabajador) filtros.trabajador_id = filterTrabajador
    if (filterProyecto) filtros.proyecto_id = filterProyecto
    actividadesApi.listarMes(mes, filtros)
      .then((res) => setActividades(res.actividades || []))
      .catch((err) => {
        const msg = err.response?.data?.detail || err.message || 'Error desconocido'
        if (!silent) {
          setError(`No se pudo cargar la agenda: ${msg}`)
          setActividades([])
        }
      })
      .finally(() => {
        if (!silent) setLoading(false)
        fetchedRef.current = true
      })
  }, [mes, filterTrabajador, filterProyecto])

  useEffect(() => { fetchActividades() }, [fetchActividades])

  useEffect(() => {
    if (!fetchedRef.current) return undefined
    const id = setInterval(() => fetchActividades(true), 20_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchActividades(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchActividades])

  useEffect(() => { setSelectedDay(null) }, [mes])

  const shift = (delta) => {
    const d = new Date(anchor + 'T12:00:00')
    if (view === 'semana') d.setDate(d.getDate() + delta * 7)
    else d.setMonth(d.getMonth() + delta)
    setAnchor(isoOf(d))
  }
  const goToday = () => { setAnchor(today.iso); setSelectedDay(today.iso) }

  const actsByDay = useMemo(() => {
    const m = {}
    for (const a of actividades) {
      if (!a.fecha_dia) continue
      if (!m[a.fecha_dia]) m[a.fecha_dia] = []
      m[a.fecha_dia].push(a)
    }
    return m
  }, [actividades])

  const selectedActs = selectedDay ? (actsByDay[selectedDay] || []) : []

  const iniciadas = actividades.filter((a) => a.desestadoactividad === 'iniciado').length
  const finalizadas = actividades.filter((a) => a.desestadoactividad === 'finalizado').length

  const handleOpen = (a) => {
    if (canManage) setEditingId(a.id)
  }

  const headerLabel = view === 'semana'
    ? (() => {
        const w = weekOf(new Date(anchor + 'T12:00:00'))
        const first = w[0]
        const last = w[6]
        const sameMonth = first.getMonth() === last.getMonth()
        return sameMonth
          ? `${first.getDate()}–${last.getDate()} ${MESES[first.getMonth()]} ${first.getFullYear()}`
          : `${first.getDate()} ${MESES[first.getMonth()].slice(0,3)} – ${last.getDate()} ${MESES[last.getMonth()].slice(0,3)} ${last.getFullYear()}`
      })()
    : `${MESES[month - 1]} ${year}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading
              ? 'Cargando…'
              : (
                <>
                  {actividades.length} {actividades.length === 1 ? 'actividad' : 'actividades'} en{' '}
                  {MESES[month - 1]} {year}
                  {actividades.length > 0 && (
                    <span className="text-slate-400 ml-1">
                      · {iniciadas} en curso · {finalizadas} finalizadas
                    </span>
                  )}
                </>
              )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtros */}
          {canManage && trabajadoresCat.length > 0 && (
            <select
              value={filterTrabajador}
              onChange={(e) => setFilterTrabajador(e.target.value)}
              className="input input-sm w-48"
            >
              <option value="">Todos los trabajadores</option>
              {trabajadoresCat.map((t) => (
                <option key={t.id} value={t.id}>{t.nbrcompleto}</option>
              ))}
            </select>
          )}
          {canManage && proyectosCat.length > 0 && (
            <select
              value={filterProyecto}
              onChange={(e) => setFilterProyecto(e.target.value)}
              className="input input-sm w-40"
            >
              <option value="">Todos los proyectos</option>
              {proyectosCat.map((p) => (
                <option key={p.id} value={p.id}>{p.descontratoproyecto || p.nbrproyecto}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Toolbar: view toggle + groupBy + navegación */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'mes', label: 'Mes', icon: Icon.Layers },
              { value: 'semana', label: 'Semana', icon: Icon.Calendar },
              { value: 'lista', label: 'Lista', icon: Icon.Inbox },
            ]}
          />
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-slate-400">Ver por:</span>
            <Segmented
              value={groupBy}
              onChange={setGroupBy}
              options={[
                { value: 'trabajador', label: 'Trabajador', icon: Icon.Users },
                { value: 'actividad', label: 'Actividad', icon: Icon.Tag },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="icon-btn" aria-label="Anterior">
            <Icon.ArrowUp className="w-4 h-4 -rotate-90" />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[180px] text-center capitalize tabular-nums">
            {headerLabel}
          </span>
          <button onClick={() => shift(1)} className="icon-btn" aria-label="Siguiente">
            <Icon.ArrowUp className="w-4 h-4 rotate-90" />
          </button>
          <button onClick={goToday} className="btn-secondary btn-sm ml-1">Hoy</button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* Cuerpo */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          {view === 'mes' && (
            <MonthView
              year={year} month={month}
              actsByDay={actsByDay}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              today={today}
              groupBy={groupBy}
              onOpen={handleOpen}
            />
          )}
          {view === 'semana' && (
            <WeekView
              anchor={anchor}
              actsByDay={actsByDay}
              today={today}
              groupBy={groupBy}
              onOpen={handleOpen}
            />
          )}
          {view === 'lista' && (
            <ListView actsByDay={actsByDay} groupBy={groupBy} onOpen={handleOpen} />
          )}
        </div>

        {/* Panel lateral: sólo mes + día seleccionado */}
        {view === 'mes' && selectedDay && (
          <DayPanel
            date={selectedDay}
            actividades={selectedActs}
            groupBy={groupBy}
            onClose={() => setSelectedDay(null)}
            onOpen={handleOpen}
          />
        )}
      </div>

      {/* Leyenda de colores — convención de monitoreo */}
      <div className="flex items-center gap-4 flex-wrap px-1">
        <span className="text-xs text-slate-400 font-medium">Estados:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-500">En curso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          <span className="text-xs text-slate-500">Finalizadas</span>
        </div>
      </div>

      {editingId && (
        <EditarActividadModal
          actividadId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null)
            fetchActividades(true)
          }}
          canDelete={user?.role === 'admin'}
        />
      )}
    </div>
  )
}
