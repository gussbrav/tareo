/**
 * Agenda — Vista calendaria (mes/semana/lista) de actividades.
 *
 * Mes:    grilla 7×N que llena el viewport (sin scroll externo)
 * Semana: time-grid estilo Google Calendar (eje horario vertical + línea "ahora")
 * Lista:  agrupado por día con scroll interno
 *
 * groupBy:
 *   - "trabajador" → un pill por asignación individual
 *   - "actividad"  → colapsa por descripción con badge "N×"
 *
 * Colores (convención de monitoreo, unificada):
 *   - iniciado   → emerald (activo)
 *   - finalizado → slate   (histórico)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { actividadesApi } from '../api/actividades'
import { adminApi } from '../api/admin'
import EditarActividadModal from '../components/EditarActividadModal.jsx'
import { Icon } from '../components/admin/Icons.jsx'
import StatusPill from '../components/admin/StatusPill.jsx'
import { useAuthStore } from '../store/auth'
import { fmtHM } from '../lib/format'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const ESTADO_STYLE = {
  iniciado:   { bg: 'bg-emerald-500', text: 'text-white', tone: 'emerald', ring: 'ring-emerald-400' },
  finalizado: { bg: 'bg-slate-400',   text: 'text-white', tone: 'slate',   ring: 'ring-slate-300' },
}
const getEstadoStyle = (estado) =>
  ESTADO_STYLE[(estado || '').toLowerCase()] || { bg: 'bg-slate-300', text: 'text-white', tone: 'slate' }

// ─── Helpers de fecha/hora ────────────────────────────────────────────────

function getLocalToday() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), iso: isoOf(d) }
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
  for (let i = startDow - 1; i >= 0; i--) cells.push({ day: prevDays - i, current: false, key: `prev-${i}` })
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, current: true, key: iso, iso })
  }
  let next = 1
  while (cells.length % 7 !== 0) cells.push({ day: next++, current: false, key: `next-${next}` })
  return cells
}

/** "14:30:00" o "14:30" → 870 (minutos desde 00:00). */
function timeToMinutes(t) {
  if (!t) return null
  const [h, m] = String(t).split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (m || 0)
}

function fmtHour12(h) {
  const suffix = h >= 12 ? 'PM' : 'AM'
  const disp = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${disp} ${suffix}`
}

// ─── Agrupación por descripción única ─────────────────────────────────────
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

// ─── Pills / Cards ─────────────────────────────────────────────────────────

function MonthPill({ item, groupBy, onOpen }) {
  const { bg, text } = getEstadoStyle(item.desestadoactividad)
  const hora = fmtHM(item.horinicio)
  const label = groupBy === 'actividad'
    ? (item.desactividad || 'Sin descripción')
    : item.trabajador_nombre
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen?.(item) }}
      className={`block w-full text-left rounded px-1 py-0 text-[10px] font-medium truncate leading-[15px]
                  transition-all cursor-pointer hover:brightness-110
                  ${bg} ${text}`}
      title={groupBy === 'actividad'
        ? `${item.desactividad} · ${item.trabajador_nombre}`
        : `${item.trabajador_nombre} · ${item.desactividad || ''}`}
    >
      <div className="flex items-center gap-1 truncate">
        {groupBy === 'actividad' && item.count > 1 && (
          <span className="shrink-0 opacity-90 tabular-nums font-semibold">{item.count}×</span>
        )}
        {hora && <span className="opacity-75 shrink-0 tabular-nums">{hora}</span>}
        <span className="truncate">{label}</span>
      </div>
    </button>
  )
}

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
  const rows = cells.length / 7

  return (
    <div className="card-flush h-full flex flex-col">
      <div className="grid grid-cols-7 border-b border-slate-100 shrink-0 bg-slate-50/40">
        {DIAS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
          // Mostrar hasta 4 pills; el resto como "+N" compacto.
          const MAX = 4
          const shown = dayItems.slice(0, MAX)
          const extras = Math.max(0, total - MAX)
          const borders = idx % 7 !== 0 ? 'border-l border-slate-100' : ''
          return (
            <div
              key={cell.key}
              onClick={() => cell.current && setSelectedDay(isSelected ? null : cell.iso)}
              className={`p-1 flex flex-col gap-0.5 border-b border-slate-100 overflow-hidden ${borders}
                          ${cell.current ? 'cursor-pointer hover:bg-slate-50/60' : 'bg-slate-50/40 cursor-default'}
                          ${isSelected ? 'bg-brand-50/70 hover:bg-brand-50/70' : ''}`}
            >
              <div className="flex items-center justify-between shrink-0 h-4">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-semibold
                                  ${isToday ? 'bg-brand-600 text-white' : ''}
                                  ${!isToday && cell.current ? 'text-slate-700' : ''}
                                  ${!cell.current ? 'text-slate-300' : ''}
                                  ${isSelected && !isToday ? 'text-brand-700' : ''}`}>
                  {cell.day}
                </span>
              </div>
              <div className="space-y-[2px] flex-1 min-h-0 overflow-hidden">
                {shown.map((it) => (
                  <MonthPill key={it.id} item={it} groupBy={groupBy} onOpen={onOpen} />
                ))}
                {extras > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenDay(cell.iso) }}
                    className="inline-block text-[10px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100
                               px-1.5 py-0 rounded tabular-nums leading-[14px] transition-colors"
                    title={`Ver ${extras} más`}
                  >
                    +{extras}
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

// ─── VIEW: Semana (time-grid estilo Google Calendar) ──────────────────────

const HOUR_HEIGHT = 44 // px por hora
const START_HOUR = 6
const END_HOUR = 22
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

function nowMinutesLocal() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function WeekView({ anchor, itemsByDay, today, groupBy, onOpen }) {
  const week = useMemo(() => weekOf(new Date(anchor + 'T12:00:00')), [anchor])
  const [nowMin, setNowMin] = useState(nowMinutesLocal())
  const scrollRef = useRef(null)

  // Actualiza la línea roja cada minuto
  useEffect(() => {
    const id = setInterval(() => setNowMin(nowMinutesLocal()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll a "ahora" al montar (o a 8 AM si estamos fuera del rango visible)
  useEffect(() => {
    if (!scrollRef.current) return
    const target = nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60
      ? nowMin - START_HOUR * 60 - 90 // 1.5h de contexto arriba
      : (8 - START_HOUR) * 60         // 8 AM por default
    scrollRef.current.scrollTop = Math.max(0, (target / 60) * HOUR_HEIGHT)
    // solo mount — anchor changes handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cuando cambia la semana anclada, scrollear también
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = Math.max(0, ((8 - START_HOUR) * 60 / 60) * HOUR_HEIGHT)
  }, [anchor])

  const totalHeight = HOURS.length * HOUR_HEIGHT

  const nowVisible = nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60
  const nowTop = nowVisible ? ((nowMin - START_HOUR * 60) / 60) * HOUR_HEIGHT : 0

  return (
    <div className="card-flush h-full flex flex-col overflow-hidden">
      {/* Header de días */}
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-100 shrink-0">
        <div className="border-r border-slate-100" />
        {week.map((d) => {
          const iso = isoOf(d)
          const isToday = iso === today.iso
          const dowLabel = DIAS[d.getDay() === 0 ? 6 : d.getDay() - 1]
          return (
            <div key={iso} className="py-1.5 text-center border-l border-slate-100 first:border-l-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {dowLabel}
              </div>
              <div className={`mt-0.5 inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold
                                ${isToday ? 'bg-brand-600 text-white' : 'text-slate-700'}`}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] relative"
          style={{ height: totalHeight }}
        >
          {/* Eje horario */}
          <div className="border-r border-slate-100 relative">
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="relative">
                <span className="absolute -top-1.5 right-1.5 text-[10px] text-slate-400 tabular-nums leading-none">
                  {fmtHour12(h)}
                </span>
              </div>
            ))}
          </div>

          {/* Columnas por día */}
          {week.map((d) => {
            const iso = isoOf(d)
            const items = itemsByDay[iso] || []
            const isToday = iso === today.iso
            return (
              <div key={iso} className="relative border-l border-slate-100 first:border-l-0">
                {/* Líneas de hora (fondo) */}
                {HOURS.map((h, i) => (
                  <div
                    key={h}
                    style={{ height: HOUR_HEIGHT }}
                    className={`border-t ${i === 0 ? 'border-transparent' : 'border-slate-100'}`}
                  />
                ))}
                {/* Eventos */}
                {items.map((it) => (
                  <WeekEvent key={it.id} item={it} groupBy={groupBy} onOpen={onOpen} />
                ))}
                {/* Línea "ahora" (solo en la columna del día actual) */}
                {isToday && nowVisible && (
                  <div
                    className="absolute inset-x-0 pointer-events-none z-10"
                    style={{ top: nowTop }}
                  >
                    <div className="relative">
                      <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500 shadow-sm" />
                      <div className="h-[1.5px] bg-red-500" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WeekEvent({ item, groupBy, onOpen }) {
  const startMin = timeToMinutes(item.horinicio)
  if (startMin == null) return null
  const endMin = timeToMinutes(item.horfin) || (startMin + 30)
  // Clipeamos a la ventana visible
  const clampedStart = Math.max(START_HOUR * 60, startMin)
  const clampedEnd = Math.min(END_HOUR * 60, Math.max(endMin, startMin + 15))
  if (clampedEnd <= START_HOUR * 60 || clampedStart >= END_HOUR * 60) return null

  const top = ((clampedStart - START_HOUR * 60) / 60) * HOUR_HEIGHT
  const height = Math.max(16, ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT)

  const { bg, text } = getEstadoStyle(item.desestadoactividad)
  const label = groupBy === 'actividad'
    ? (item.desactividad || 'Sin descripción')
    : item.trabajador_nombre

  const isShort = height < 26

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      style={{ top, height, left: 2, right: 2 }}
      className={`absolute rounded-md px-1.5 text-left overflow-hidden shadow-sm
                  transition-all hover:brightness-110 hover:shadow
                  ${bg} ${text} ${isShort ? 'py-0' : 'py-1'}`}
      title={`${item.trabajador_nombre} · ${item.desactividad || ''}`}
    >
      <div className={`flex items-center gap-1 ${isShort ? 'text-[9px]' : 'text-[10px]'} font-semibold truncate leading-tight`}>
        {groupBy === 'actividad' && item.count > 1 && (
          <span className="opacity-90 tabular-nums shrink-0">{item.count}×</span>
        )}
        <span className="tabular-nums opacity-90 shrink-0">{fmtHM(item.horinicio)}</span>
        <span className="truncate">{label}</span>
      </div>
      {!isShort && groupBy === 'trabajador' && item.desactividad && (
        <div className="text-[9px] opacity-90 truncate leading-tight mt-0.5">{item.desactividad}</div>
      )}
    </button>
  )
}

// ─── VIEW: Lista (estilo Gmail/CRM — filas flat) ──────────────────────────
const DIAS_CORTOS_LC = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtDateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  const dow = DIAS_CORTOS_LC[dateObj.getDay()]
  return `${dow.charAt(0).toUpperCase() + dow.slice(1)}, ${String(d).padStart(2, '0')} ${MESES_CORTOS[m - 1]}.`
}

function ListView({ itemsByDay, groupBy, onOpen }) {
  // Flatten a lista lineal ordenada por fecha + hora
  const rows = useMemo(() => {
    const out = []
    for (const iso of Object.keys(itemsByDay).sort()) {
      for (const it of itemsByDay[iso]) out.push(it)
    }
    return out
  }, [itemsByDay])

  if (rows.length === 0) {
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
      {rows.map((it) => {
        const { tone } = getEstadoStyle(it.desestadoactividad)
        const isGroup = !!it.isGroup
        const primary = groupBy === 'actividad'
          ? (it.desactividad || 'Sin descripción')
          : it.trabajador_nombre
        const secondaryParts = []
        if (groupBy === 'actividad') {
          secondaryParts.push(it.trabajador_nombre)
        } else if (it.desactividad) {
          secondaryParts.push(it.desactividad)
        }
        if (it.centro_costo_nombre) secondaryParts.push(`CC: ${it.centro_costo_nombre}`)
        const secondary = secondaryParts.join(' · ')

        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onOpen?.(it)}
            className="w-full text-left flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            {/* Hora + fecha */}
            <div className="w-[92px] shrink-0 tabular-nums">
              <div className="text-sm font-semibold text-slate-900 leading-tight">
                {fmtHM(it.horinicio) || '—'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {fmtDateLabel(it.fecha_dia)}
              </div>
            </div>

            {/* Título + subtítulo */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5">
                {isGroup && it.count > 1 && (
                  <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded tabular-nums shrink-0">
                    {it.count}×
                  </span>
                )}
                {primary}
              </div>
              {secondary && (
                <div className="text-xs text-slate-500 truncate mt-0.5">{secondary}</div>
              )}
            </div>

            {/* Pill de estado a la derecha */}
            <div className="shrink-0">
              <StatusPill tone={tone}>{it.desestadoactividad}</StatusPill>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Panel lateral (día seleccionado, solo Mes) ───────────────────────────
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

// ─── Segmented control ────────────────────────────────────────────────────
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

  const actsByDay = useMemo(() => {
    const m = {}
    for (const a of actividades) {
      if (!a.fecha_dia) continue
      if (!m[a.fecha_dia]) m[a.fecha_dia] = []
      m[a.fecha_dia].push(a)
    }
    return m
  }, [actividades])

  const itemsByDay = useMemo(() => {
    if (groupBy !== 'actividad') return actsByDay
    const out = {}
    for (const [day, list] of Object.entries(actsByDay)) {
      out[day] = collapseByActividad(list)
    }
    return out
  }, [actsByDay, groupBy])

  const selectedRaw = selectedDay ? (actsByDay[selectedDay] || []) : []

  const iniciadas = actividades.filter((a) => a.desestadoactividad === 'iniciado').length
  const finalizadas = actividades.filter((a) => a.desestadoactividad === 'finalizado').length

  const handleOpen = (item) => {
    if (!canManage) return
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

  // Sin footer del AppShell: chrome = 56 (header) + 32 (main padding).
  // Ajustamos con 100dvh - 5.5rem (88px) para llenar exacto.
  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] min-h-[560px] overflow-hidden gap-3">
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
