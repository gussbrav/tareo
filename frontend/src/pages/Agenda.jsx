/**
 * Agenda — Vista calendaria (mes/semana/lista) de actividades.
 *
 * Vistas:
 *   - Mes: grilla 7×6 que llena el viewport (sin scroll externo)
 *   - Semana: 7 columnas con cards apiladas por día (scroll vertical interno)
 *   - Lista: grouped por día (scroll vertical interno)
 *
 * Agrupación (groupBy):
 *   - "trabajador" → un pill por asignación individual
 *   - "actividad"  → un pill por descripción única, con contador "N×"
 *
 * Colores (convención de monitoreo, unificada en toda la app):
 *   - iniciado   → emerald  (activo, en curso)
 *   - finalizado → slate    (histórico, no requiere atención)
 *
 * Read-only para trabajador; admin/supervisor pueden abrir EditarActividadModal.
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

function weekOf(date) {
  const d = new Date(date)
  const dow = d.getDay()
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

// ─── Agrupación por actividad ──────────────────────────────────────────────
// Cuando groupBy=actividad, cada día devuelve un item por descripción única
// con { count, _items, _trabajadores } para renderizar "N× {actividad}".

function collapseByActividad(actividades) {
  const map = new Map()
  for (const a of actividades) {
    const key = (a.desactividad || 'Sin descripción').trim().toLowerCase()
    if (!map.has(key)) {
      map.set(key, {
        id: `grp-${a.fecha_dia}-${key}`,
        isGroup: true,
        desactividad: a.desactividad || 'Sin descripción',
        fecha_dia: a.fecha_dia,
        horinicio: a.horinicio,
        horfin: a.horfin,
        centro_costo_nombre: a.centro_costo_nombre,
        desestadoactividad: 'finalizado',
        _items: [],
        _trabajadoresSet: new Set(),
      })
    }
    const g = map.get(key)
    g._items.push(a)
    if (a.trabajador_nombre) g._trabajadoresSet.add(a.trabajador_nombre)
    if (a.desestadoactividad === 'iniciado') g.desestadoactividad = 'iniciado'
    if (a.horinicio && (!g.horinicio || a.horinicio < g.horinicio)) g.horinicio = a.horinicio
  }
  return Array.from(map.values()).map((g) => ({
    ...g,
    count: g._trabajadoresSet.size,
    trabajador_nombre: `${g._trabajadoresSet.size} trabajador${g._trabajadoresSet.size === 1 ? '' : 'es'}`,
  }))
}

// ─── Pill compacto (Mes) ───────────────────────────────────────────────────
function ActividadPill({ item, groupBy, onOpen }) {
  const { bg, text } = getEstadoStyle(item.desestadoactividad)
  const hora = fmtHM(item.horinicio)
  const label = groupBy === 'actividad'
    ? (item.desactividad || 'Sin descripción')
    : item.trabajador_nombre
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen?.(item) }}
      className={`block w-full text-left rounded px-1.5 py-[1px] text-[10px] font-medium truncate
                  transition-all cursor-pointer hover:brightness-110 hover:shadow-sm
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                  focus-visible:ring-offset-1 focus-visible:ring-offset-brand-500
                  ${bg} ${text}`}
      title={groupBy === 'actividad'
        ? `${item.desactividad} · ${item.trabajador_nombre}`
        : `${item.trabajador_nombre} · ${item.desactividad || ''}`}
    >
      <div className="flex items-center gap-1 truncate">
        {groupBy === 'actividad' && item.count > 1 && (
          <span className="shrink-0 opacity-80 tabular-nums">{item.count}×</span>
        )}
        {hora && <span className="opacity-75 shrink-0 tabular-nums">{hora}</span>}
        <span className="truncate">{label}</span>
      </div>
    </button>
  )
}

// ─── Card (Semana / Lista / DayPanel) ──────────────────────────────────────
function ActividadCard({ item, groupBy, onOpen }) {
  const { tone } = getEstadoStyle(item.desestadoactividad)
  const isGroup = !!item.isGroup
  const primary = groupBy === 'actividad'
    ? (item.desactividad || 'Sin descripción')
    : item.trabajador_nombre
  const secondary = groupBy === 'actividad'
    ? item.trabajador_nombre
    : item.desactividad
  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className="w-full text-left border border-slate-200 rounded-lg p-2.5 space-y-1
                 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <StatusPill tone={tone}>{item.desestadoactividad}</StatusPill>
        <span className="text-[11px] font-mono tabular-nums text-slate-500">
          {fmtHM(item.horinicio)}{item.horfin ? ` → ${fmtHM(item.horfin)}` : ''}
        </span>
      </div>
      <div className="text-sm font-medium text-slate-900 line-clamp-1 flex items-center gap-1.5">
        {isGroup && item.count > 1 && (
          <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded tabular-nums shrink-0">
            {item.count}×
          </span>
        )}
        {primary}
      </div>
      {secondary && (
        <p className="text-xs text-slate-600 line-clamp-2">{secondary}</p>
      )}
      {item.centro_costo_nombre && (
        <p className="text-[11px] text-slate-500 truncate">
          <span className="text-slate-400">CC:</span> {item.centro_costo_nombre}
        </p>
      )}
    </button>
  )
}

// ─── VIEW: Mes ─────────────────────────────────────────────────────────────
function MonthView({ year, month, itemsByDay, selectedDay, setSelectedDay, today, groupBy, onOpen, onOpenDay }) {
  const cells = useMemo(() => buildMonthCells(year, month), [year, month])
  const rows = cells.length / 7 // 5 o 6

  return (
    <div className="card-flush h-full flex flex-col">
      <div className="grid grid-cols-7 border-b border-slate-100 shrink-0">
        {DIAS.map((d) => (
          <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {d}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {cells.map((cell, idx) => {
          const isToday = cell.current && cell.iso === today.iso
          const isSelected = cell.current && cell.iso === selectedDay
          const dayItems = cell.iso ? (itemsByDay[cell.iso] || []) : []
          const total = dayItems.length
          // Cuántos pills caben depende de la altura de la celda.
          // Usamos un límite conservador — el resto se muestra como "+N más"
          // que abre el DayPanel.
          const MAX = 3
          const shown = dayItems.slice(0, MAX)
          const extras = Math.max(0, total - MAX)
          const borders = idx % 7 !== 0 ? 'border-l border-slate-100' : ''
          return (
            <div
              key={cell.key}
              onClick={() => cell.current && setSelectedDay(isSelected ? null : cell.iso)}
              className={`p-1 flex flex-col gap-0.5 border-b border-slate-100 overflow-hidden ${borders}
                          ${cell.current ? 'cursor-pointer hover:bg-slate-50/60' : 'bg-slate-50/40 cursor-default'}
                          ${isSelected ? 'bg-brand-50/60 hover:bg-brand-50/60' : ''}`}
            >
              <div className="flex items-center justify-between shrink-0">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-semibold
                                  ${isToday ? 'bg-brand-600 text-white' : ''}
                                  ${!isToday && cell.current ? 'text-slate-700' : ''}
                                  ${!cell.current ? 'text-slate-300' : ''}
                                  ${isSelected && !isToday ? 'text-brand-700' : ''}`}>
                  {cell.day}
                </span>
                {total > 0 && (
                  <span className="text-[9px] font-bold text-brand-700 bg-brand-50 px-1 rounded-full tabular-nums leading-none py-[3px]">
                    {total}
                  </span>
                )}
              </div>
              <div className="space-y-0.5 flex-1 min-h-0 overflow-hidden">
                {shown.map((it) => (
                  <ActividadPill key={it.id} item={it} groupBy={groupBy} onOpen={onOpen} />
                ))}
                {extras > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenDay(cell.iso) }}
                    className="text-[10px] text-slate-500 font-medium pl-1 hover:text-brand-600 hover:underline transition-colors block"
                  >
                    +{extras} más
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── VIEW: Semana ──────────────────────────────────────────────────────────
function WeekView({ anchor, itemsByDay, today, groupBy, onOpen }) {
  const week = useMemo(() => weekOf(new Date(anchor + 'T12:00:00')), [anchor])
  return (
    <div className="card-flush h-full flex flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-100 min-w-[720px] shrink-0">
        {week.map((d) => {
          const iso = isoOf(d)
          const isToday = iso === today.iso
          return (
            <div key={iso} className="py-2 px-2 text-center border-l border-slate-100 first:border-l-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {DIAS[d.getDay() === 0 ? 6 : d.getDay() - 1]}
              </div>
              <div className={`mt-0.5 inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold
                                ${isToday ? 'bg-brand-600 text-white' : 'text-slate-700'}`}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-7 min-w-[720px] overflow-y-auto flex-1">
        {week.map((d, idx) => {
          const iso = isoOf(d)
          const items = itemsByDay[iso] || []
          const borders = idx > 0 ? 'border-l border-slate-100' : ''
          return (
            <div key={iso} className={`p-2 space-y-1.5 ${borders}`}>
              {items.length === 0 ? (
                <div className="h-full min-h-[120px] flex items-center justify-center text-[11px] text-slate-300">
                  —
                </div>
              ) : (
                items.map((it) => (
                  <ActividadCard key={it.id} item={it} groupBy={groupBy} onOpen={onOpen} />
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── VIEW: Lista ───────────────────────────────────────────────────────────
function ListView({ itemsByDay, groupBy, onOpen }) {
  const days = Object.keys(itemsByDay).sort()
  if (days.length === 0) {
    return (
      <div className="card-flush h-full flex items-center justify-center">
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
    <div className="card-flush h-full overflow-y-auto divide-y divide-slate-100">
      {days.map((iso) => {
        const [y, m, d] = iso.split('-').map(Number)
        const dateObj = new Date(y, m - 1, d)
        const dow = dateObj.getDay()
        const dowLabel = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][dow]
        const items = itemsByDay[iso]
        return (
          <div key={iso}>
            <div className="px-4 py-2 bg-slate-50/70 flex items-center justify-between sticky top-0 z-[1]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {d} {MESES[m - 1]}
                </span>
                <span className="text-xs text-slate-500">{dowLabel}</span>
              </div>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {items.map((it) => (
                <ActividadCard key={it.id} item={it} groupBy={groupBy} onOpen={onOpen} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Panel lateral (día seleccionado, solo vista Mes) ──────────────────────
function DayPanel({ date, items, groupBy, onClose, onOpen }) {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  const label = `${d} de ${MESES[m - 1]} ${y}`
  return (
    <div className="w-80 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <Icon.Calendar className="w-4 h-4 text-brand-600" />
          <span className="text-sm font-semibold text-slate-800">{label}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
          <Icon.X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Sin actividades este día</p>
        ) : (
          items.map((it) => (
            <ActividadCard key={it.id} item={it} groupBy={groupBy} onOpen={onOpen} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Segmented control ─────────────────────────────────────────────────────
function Segmented({ value, onChange, options, size = 'md' }) {
  const cls = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-slate-100/70 rounded-lg">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`${cls} rounded-md font-medium transition-all inline-flex items-center gap-1.5
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
  const [view, setView] = useState('mes')
  const [groupBy, setGroupBy] = useState('trabajador')
  const [anchor, setAnchor] = useState(today.iso)
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
  const goToday = () => { setAnchor(today.iso); setSelectedDay(view === 'mes' ? today.iso : null) }

  // Actividades crudas → índice por día
  const actsByDay = useMemo(() => {
    const m = {}
    for (const a of actividades) {
      if (!a.fecha_dia) continue
      if (!m[a.fecha_dia]) m[a.fecha_dia] = []
      m[a.fecha_dia].push(a)
    }
    return m
  }, [actividades])

  // Items renderizados: raw (trabajador) o colapsados por descripción (actividad)
  const itemsByDay = useMemo(() => {
    if (groupBy !== 'actividad') return actsByDay
    const out = {}
    for (const [day, list] of Object.entries(actsByDay)) {
      out[day] = collapseByActividad(list)
    }
    return out
  }, [actsByDay, groupBy])

  // Para el DayPanel siempre mostramos individuales (drill-down claro).
  const selectedRaw = selectedDay ? (actsByDay[selectedDay] || []) : []

  const iniciadas = actividades.filter((a) => a.desestadoactividad === 'iniciado').length
  const finalizadas = actividades.filter((a) => a.desestadoactividad === 'finalizado').length

  const handleOpen = (item) => {
    if (!canManage) return
    // Si es un grupo (varias asignaciones de la misma actividad), abrir el
    // panel del día en vez del modal — el usuario elige cuál trabajador editar.
    if (item.isGroup) {
      setSelectedDay(item.fecha_dia)
      return
    }
    setEditingId(item.id)
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

  // Layout no-scroll para la vista Mes: fija la altura del contenedor al
  // viewport disponible menos el chrome del AppShell (header 56 + padding
  // + footer ~ 130px). Usamos 100dvh para respetar el chrome del navegador
  // móvil. Las demás vistas también se benefician (scroll interno).
  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] min-h-[560px] overflow-hidden gap-3">
      {/* Header compacto (single row on desktop) */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-baseline gap-3 flex-wrap min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 leading-none">Agenda</h1>
          <p className="text-sm text-slate-500">
            {loading
              ? 'Cargando…'
              : (
                <>
                  {actividades.length} {actividades.length === 1 ? 'actividad' : 'actividades'} en{' '}
                  <span className="capitalize">{MESES[month - 1]} {year}</span>
                  {actividades.length > 0 && (
                    <span className="text-slate-400 ml-1">
                      · <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          {iniciadas} en curso
                        </span>
                      {' '} · <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                          {finalizadas} finalizadas
                        </span>
                    </span>
                  )}
                </>
              )}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => shift(-1)} className="icon-btn" aria-label="Anterior">
            <Icon.ArrowUp className="w-4 h-4 -rotate-90" />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[170px] text-center capitalize tabular-nums">
            {headerLabel}
          </span>
          <button onClick={() => shift(1)} className="icon-btn" aria-label="Siguiente">
            <Icon.ArrowUp className="w-4 h-4 rotate-90" />
          </button>
          <button onClick={goToday} className="btn-secondary btn-sm ml-1">Hoy</button>
        </div>
      </div>

      {/* Toolbar: view + groupBy + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'mes', label: 'Mes', icon: Icon.Layers },
              { value: 'semana', label: 'Semana', icon: Icon.Calendar },
              { value: 'lista', label: 'Lista', icon: Icon.Inbox },
            ]}
          />
          <Segmented
            value={groupBy}
            onChange={setGroupBy}
            size="sm"
            options={[
              { value: 'trabajador', label: 'Por trabajador', icon: Icon.Users },
              { value: 'actividad', label: 'Por actividad', icon: Icon.Tag },
            ]}
          />
        </div>

        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            {trabajadoresCat.length > 0 && (
              <select
                value={filterTrabajador}
                onChange={(e) => setFilterTrabajador(e.target.value)}
                className="input input-sm w-44"
              >
                <option value="">Todos los trabajadores</option>
                {trabajadoresCat.map((t) => (
                  <option key={t.id} value={t.id}>{t.nbrcompleto}</option>
                ))}
              </select>
            )}
            {proyectosCat.length > 0 && (
              <select
                value={filterProyecto}
                onChange={(e) => setFilterProyecto(e.target.value)}
                className="input input-sm w-36"
              >
                <option value="">Todos los proyectos</option>
                {proyectosCat.map((p) => (
                  <option key={p.id} value={p.id}>{p.descontratoproyecto || p.nbrproyecto}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 shrink-0">
          {error}
        </div>
      )}

      {/* Cuerpo: llena el espacio restante */}
      <div className="flex gap-3 items-stretch flex-1 min-h-0">
        <div className="flex-1 min-w-0 min-h-0">
          {view === 'mes' && (
            <MonthView
              year={year} month={month}
              itemsByDay={itemsByDay}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              today={today}
              groupBy={groupBy}
              onOpen={handleOpen}
              onOpenDay={(iso) => setSelectedDay(iso)}
            />
          )}
          {view === 'semana' && (
            <WeekView
              anchor={anchor}
              itemsByDay={itemsByDay}
              today={today}
              groupBy={groupBy}
              onOpen={handleOpen}
            />
          )}
          {view === 'lista' && (
            <ListView itemsByDay={itemsByDay} groupBy={groupBy} onOpen={handleOpen} />
          )}
        </div>

        {view === 'mes' && selectedDay && (
          <DayPanel
            date={selectedDay}
            items={selectedRaw}
            groupBy="trabajador"
            onClose={() => setSelectedDay(null)}
            onOpen={handleOpen}
          />
        )}
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
