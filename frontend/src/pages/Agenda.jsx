/**
 * Agenda — Vista mensual de actividades (patrón calendar tipo Google Calendar,
 * mismo estilo que la agenda del CRM Palma Río pero adaptado a Tareo).
 *
 * Read-only: click en una actividad abre el EditarActividadModal para
 * admin/supervisor. Trabajador ve solo sus propias actividades.
 *
 * Polling 20s + refresh on visibility (paridad con CRM: la agenda siempre
 * debe estar fresca cuando alguien la mira, otro supervisor pudo cargar
 * actividades desde otra sesión).
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

// Color por estado (misma paleta que StatusPill).
const ESTADO_COLOR = {
  iniciado:   { bg: 'bg-amber-500',   text: 'text-white', tone: 'amber' },
  finalizado: { bg: 'bg-emerald-500', text: 'text-white', tone: 'emerald' },
}
const getEstadoColor = (estado) =>
  ESTADO_COLOR[(estado || '').toLowerCase()] || { bg: 'bg-slate-400', text: 'text-white', tone: 'slate' }

function getLimaToday() {
  // Usamos la TZ del navegador — es lo que el usuario espera ver.
  // El backend guarda fechas como DATE simple, sin TZ.
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return {
    year: y,
    month: m,
    day,
    iso: `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
  }
}

function buildCalendarDays(year, month) {
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
    const iso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, current: true, key: iso, iso })
  }
  let next = 1
  while (cells.length % 7 !== 0) {
    cells.push({ day: next++, current: false, key: `next-${next}` })
  }
  return cells
}

/** Pill compacto dentro de la celda del calendario. */
function ActividadPill({ actividad, onOpen }) {
  const { bg, text } = getEstadoColor(actividad.desestadoactividad)
  const hora = fmtHM(actividad.horinicio)
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
        <span className="truncate">{actividad.trabajador_nombre}</span>
      </div>
    </button>
  )
}

/** Panel lateral de detalle del día seleccionado. */
function DayPanel({ date, actividades, onClose, onOpen }) {
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
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          aria-label="Cerrar"
        >
          <Icon.X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {actividades.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Sin actividades este día</p>
        ) : (
          actividades.map((a) => {
            const { tone } = getEstadoColor(a.desestadoactividad)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpen?.(a)}
                className="group relative w-full text-left border border-slate-200 rounded-xl p-3
                           bg-white hover:bg-slate-50 hover:border-slate-300
                           transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusPill tone={tone}>{a.desestadoactividad}</StatusPill>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {fmtHM(a.horinicio)}
                    {a.horfin ? ` → ${fmtHM(a.horfin)}` : ''}
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-900 truncate">
                  {a.trabajador_nombre}
                </div>
                {a.desactividad && (
                  <p className="text-xs text-slate-600 line-clamp-2">{a.desactividad}</p>
                )}
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500">
                  {a.centro_costo_nombre && (
                    <span><span className="text-slate-400">CC:</span> {a.centro_costo_nombre}</span>
                  )}
                  {a.numduracionminuto > 0 && (
                    <span><span className="text-slate-400">Dur:</span> {minutosToHoras(a.numduracionminuto)}</span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function Agenda() {
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'supervisor'

  const today = getLimaToday()
  const [year, setYear] = useState(today.year)
  const [month, setMonth] = useState(today.month)
  const [actividades, setActividades] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [filterTrabajador, setFilterTrabajador] = useState('')
  const [filterProyecto, setFilterProyecto] = useState('')
  const [trabajadoresCat, setTrabajadoresCat] = useState([])
  const [proyectosCat, setProyectosCat] = useState([])
  const [editingId, setEditingId] = useState(null)

  const mes = `${year}-${String(month).padStart(2, '0')}`

  // Catálogos (solo si canManage — para el filtro dropdown)
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

  // Polling 20s + refresh on tab visibility (paridad CRM)
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

  // Al cambiar mes, limpiar día seleccionado
  useEffect(() => { setSelectedDay(null) }, [mes])

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
  }
  const goToday = () => {
    const t = getLimaToday()
    setYear(t.year); setMonth(t.month); setSelectedDay(t.iso)
  }

  // Agrupar actividades por día
  const actividadesByDay = useMemo(() => {
    const m = {}
    for (const a of actividades) {
      if (!a.fecha_dia) continue
      if (!m[a.fecha_dia]) m[a.fecha_dia] = []
      m[a.fecha_dia].push(a)
    }
    return m
  }, [actividades])

  const cells = useMemo(() => buildCalendarDays(year, month), [year, month])
  const selectedActividades = selectedDay ? (actividadesByDay[selectedDay] || []) : []

  const iniciadas = actividades.filter((a) => a.desestadoactividad === 'iniciado').length
  const finalizadas = actividades.filter((a) => a.desestadoactividad === 'finalizado').length

  const handleOpen = (a) => {
    if (canManage) setEditingId(a.id)
    // Trabajador: read-only, no abre modal (podríamos abrir uno de lectura futuro)
  }

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

        {/* Navegación mes + filtros + Hoy */}
        <div className="flex items-center gap-2 flex-wrap">
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
          <button
            onClick={prevMonth}
            className="icon-btn"
            aria-label="Mes anterior"
          >
            <Icon.ArrowUp className="w-4 h-4 -rotate-90" />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[140px] text-center capitalize">
            {MESES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="icon-btn"
            aria-label="Mes siguiente"
          >
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

      {/* Cuerpo: grid + panel */}
      <div className="flex gap-4 items-start">
        {/* Grilla */}
        <div className="flex-1 min-w-0 card-flush">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DIAS.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400"
              >
                {d}
              </div>
            ))}
          </div>

          {loading && actividades.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-400">Cargando actividades…</div>
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((cell, idx) => {
                const isToday = cell.current && cell.iso === today.iso
                const isSelected = cell.current && cell.iso === selectedDay
                const dayActs = cell.iso ? (actividadesByDay[cell.iso] || []) : []
                const extras = dayActs.length > 3 ? dayActs.length - 3 : 0
                const borderClasses = [
                  'border-b border-slate-100',
                  idx % 7 !== 0 ? 'border-l border-slate-100' : '',
                ].join(' ')

                return (
                  <div
                    key={cell.key}
                    onClick={() => cell.current && setSelectedDay(isSelected ? null : cell.iso)}
                    className={`min-h-[96px] p-1.5 flex flex-col gap-1 ${borderClasses}
                                ${cell.current ? 'cursor-pointer hover:bg-slate-50/60' : 'bg-slate-50/40 cursor-default'}
                                ${isSelected ? 'bg-brand-50/60 hover:bg-brand-50/60' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold
                                    ${isToday ? 'bg-brand-600 text-white' : ''}
                                    ${!isToday && cell.current ? 'text-slate-700' : ''}
                                    ${!cell.current ? 'text-slate-300' : ''}
                                    ${isSelected && !isToday ? 'text-brand-700' : ''}`}
                      >
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
                        <ActividadPill key={a.id} actividad={a} onOpen={handleOpen} />
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
          )}
        </div>

        {/* Panel lateral (día seleccionado) */}
        {selectedDay && (
          <DayPanel
            date={selectedDay}
            actividades={selectedActividades}
            onClose={() => setSelectedDay(null)}
            onOpen={handleOpen}
          />
        )}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 flex-wrap px-1">
        <span className="text-xs text-slate-400 font-medium">Estados:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-xs text-slate-500">Iniciado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-500">Finalizado</span>
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
