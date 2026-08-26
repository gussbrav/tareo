/**
 * Dashboard v2 — Tareo Analytics
 * Layout: hero KPIs → tendencia → ranking + donut → heatmap + CC → alertas
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { reportesApi } from '../api/reportes'
import { useAuthStore } from '../store/auth'
import { today } from '../lib/format'
import DateField from '../components/admin/DateField.jsx'
import { Icon } from '../components/admin/Icons.jsx'
import KpiCard from '../components/dashboard/KpiCard'
import TendenciaChart from '../components/dashboard/TendenciaChart'
import RankingList from '../components/dashboard/RankingList'
import DonutCategoria from '../components/dashboard/DonutCategoria'
import HeatmapDia from '../components/dashboard/HeatmapDia'
import CcTable from '../components/dashboard/CcTable'
import TablaAlertas from '../components/dashboard/TablaAlertas'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Formatea a YYYY-MM-DD usando hora LOCAL (evita el off-by-one de toISOString
// en zonas al oeste de UTC como Lima UTC-5).
function toYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toYMD(d)
}

function startOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function startOfPrevMonth() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return toYMD(d)
}

function endOfPrevMonth() {
  const d = new Date()
  d.setDate(0) // último día del mes anterior
  return toYMD(d)
}

function startOfYear() {
  return `${new Date().getFullYear()}-01-01`
}

const PRESETS = [
  { label: 'Hoy', desde: () => today(), hasta: () => today() },
  { label: 'Ayer', desde: () => daysAgo(1), hasta: () => daysAgo(1) },
  { label: '7 días', desde: () => daysAgo(6), hasta: () => today() },
  { label: '30 días', desde: () => daysAgo(29), hasta: () => today() },
  { label: 'Este mes', desde: startOfMonth, hasta: () => today() },
  { label: 'Mes ant.', desde: startOfPrevMonth, hasta: endOfPrevMonth },
  { label: 'Este año', desde: startOfYear, hasta: () => today() },
]

// ─── Íconos SVG inline ─────────────────────────────────────────────────────────

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7.5" stroke="#1E40AF" strokeWidth="1.5" />
      <path d="M9 5v4l2.5 2.5" stroke="#1E40AF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7.5" stroke="#059669" strokeWidth="1.5" />
      <path d="M5.5 9.5L8 12L12.5 7" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPeople() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="7" cy="6" r="3" stroke="#7c3aed" strokeWidth="1.5" />
      <path d="M1 16c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 8c1.657 0 3 1.343 3 3v5" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13" cy="5.5" r="2" stroke="#7c3aed" strokeWidth="1.5" />
    </svg>
  )
}

function IconTrend() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2 13L7 8L11 11L16 5" stroke="#D9A518" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 5h3v3" stroke="#D9A518" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2L16.5 15H1.5L9 2Z" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 8v3.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="13.5" r="0.75" fill="#ef4444" />
    </svg>
  )
}

function IconRate() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="10" width="3" height="6" rx="1" fill="#1E40AF" />
      <rect x="7.5" y="6" width="3" height="10" rx="1" fill="#3B65F5" />
      <rect x="13" y="2" width="3" height="14" rx="1" fill="#93B4FD" />
    </svg>
  )
}

// ─── Filtros dimensionales ─────────────────────────────────────────────────────

function SelectFiltro({ label, value, onChange, options, placeholder = 'Todos' }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</label>
      <select
        className="input input-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.nombre}</option>
        ))}
      </select>
    </div>
  )
}

function formatRange(desde, hasta) {
  try {
    const d1 = new Date(desde + 'T00:00:00')
    const d2 = new Date(hasta + 'T00:00:00')
    const opts = { day: '2-digit', month: 'short' }
    const sameYear = d1.getFullYear() === d2.getFullYear()
    const yearOpts = sameYear ? {} : { year: 'numeric' }
    const s1 = d1.toLocaleDateString('es-PE', { ...opts, ...yearOpts })
    const s2 = d2.toLocaleDateString('es-PE', { ...opts, year: 'numeric' })
    return `${s1} → ${s2}`
  } catch {
    return `${desde} → ${hasta}`
  }
}

// ─── Estado inicial del filtro ─────────────────────────────────────────────────

const INIT = {
  desde: daysAgo(29),
  hasta: today(),
  proyecto_id: '',
  area_id: '',
  categoria_id: '',
}

function filtroReducer(state, action) {
  switch (action.type) {
    case 'SET_RANGO': return { ...state, desde: action.desde, hasta: action.hasta }
    case 'SET_FIELD': return { ...state, [action.field]: action.value }
    default: return state
  }
}

// ─── Dashboard principal ───────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore()
  const canExport = user?.role === 'admin' || user?.role === 'supervisor'

  const [filtro, dispatch] = useReducer(filtroReducer, INIT)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [presetActivo, setPresetActivo] = useState(3) // "30 días" por defecto

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const params = {}
    if (filtro.proyecto_id) params.proyecto_id = filtro.proyecto_id
    if (filtro.area_id) params.area_id = filtro.area_id
    if (filtro.categoria_id) params.categoria_id = filtro.categoria_id
    reportesApi
      .dashboard(filtro.desde, filtro.hasta, params)
      .then(setData)
      .catch(() => setError('No se pudieron cargar los datos. Verifica la conexión.'))
      .finally(() => setLoading(false))
  }, [filtro])

  // Debounce: espera 400ms tras cambios en filtro para no disparar en cada tecla
  const debounceRef = useRef(null)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(load, 400)
    return () => clearTimeout(debounceRef.current)
  }, [load])

  const handlePreset = (i) => {
    const p = PRESETS[i]
    setPresetActivo(i)
    dispatch({ type: 'SET_RANGO', desde: p.desde(), hasta: p.hasta() })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = {}
      if (filtro.proyecto_id) params.proyecto_id = filtro.proyecto_id
      if (filtro.area_id) params.area_id = filtro.area_id
      if (filtro.categoria_id) params.categoria_id = filtro.categoria_id
      await reportesApi.descargarExcel(filtro.desde, filtro.hasta, params)
    } catch {
      setError('No se pudo generar el Excel')
    } finally {
      setExporting(false)
    }
  }

  // Extraer datos memoizados
  const kpis = data?.kpis || {}
  const kpisPrev = data?.kpis_prev || {}
  const tendencia = data?.tendencia || []
  const topTrabajadores = data?.top_trabajadores || []
  const porCategoria = data?.por_categoria || []
  const porCc = data?.por_cc || []
  const heatmap = data?.heatmap || []
  const alertas = data?.alertas || []
  const catalogos = data?.catalogos || { proyectos: [], areas: [], categorias: [] }

  const horasTotales = useMemo(
    () => Math.round(((kpis.minutos_totales || 0) / 60) * 10) / 10,
    [kpis.minutos_totales],
  )
  const horasTotalesPrev = useMemo(
    () => Math.round(((kpisPrev.minutos_totales || 0) / 60) * 10) / 10,
    [kpisPrev.minutos_totales],
  )

  const diasRango = useMemo(() => {
    const d1 = new Date(filtro.desde)
    const d2 = new Date(filtro.hasta)
    return Math.max(Math.round((d2 - d1) / 86400000) + 1, 1)
  }, [filtro.desde, filtro.hasta])

  return (
    <div className="space-y-6">
      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1 tabular-nums">
            {formatRange(filtro.desde, filtro.hasta)} <span className="text-slate-400">· {diasRango} días</span>
          </p>
        </div>
        {canExport && (
          <button className="btn-secondary btn-sm" onClick={handleExport} disabled={exporting || loading}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {exporting ? 'Generando…' : 'Exportar Excel'}
          </button>
        )}
      </div>

      {/* ── Panel de filtros ── */}
      <div className="card !p-4 space-y-4">
        {/* Presets — segmented control */}
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100/70 rounded-lg">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => handlePreset(i)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                presetActivo === i
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Rango manual + filtros dimensionales */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Desde</label>
            <DateField
              className="input-sm"
              value={filtro.desde}
              onChange={(e) => {
                setPresetActivo(null)
                dispatch({ type: 'SET_FIELD', field: 'desde', value: e.target.value })
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Hasta</label>
            <DateField
              className="input-sm"
              value={filtro.hasta}
              onChange={(e) => {
                setPresetActivo(null)
                dispatch({ type: 'SET_FIELD', field: 'hasta', value: e.target.value })
              }}
            />
          </div>
          <SelectFiltro
            label="Proyecto"
            value={filtro.proyecto_id}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'proyecto_id', value: v })}
            options={catalogos.proyectos}
          />
          <SelectFiltro
            label="Área"
            value={filtro.area_id}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'area_id', value: v })}
            options={catalogos.areas}
          />
          <SelectFiltro
            label="Categoría"
            value={filtro.categoria_id}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'categoria_id', value: v })}
            options={catalogos.categorias}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.75" fill="currentColor" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Hero KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Horas totales"
          value={horasTotales}
          suffix="h"
          current={horasTotales}
          prev={horasTotalesPrev}
          icon={<IconClock />}
          iconBg="bg-brand-100"
          loading={loading}
        />
        <KpiCard
          label="Finalizadas"
          value={kpis.finalizadas ?? '—'}
          current={kpis.finalizadas}
          prev={kpisPrev.finalizadas}
          icon={<IconCheck />}
          iconBg="bg-emerald-50"
          loading={loading}
        />
        <KpiCard
          label="En proceso"
          value={kpis.en_proceso ?? '—'}
          current={kpis.en_proceso}
          prev={kpisPrev.en_proceso}
          invertDelta
          icon={<IconAlert />}
          iconBg="bg-red-50"
          loading={loading}
        />
        <KpiCard
          label="Trabajadores activos"
          value={kpis.trabajadores_activos ?? '—'}
          current={kpis.trabajadores_activos}
          prev={kpisPrev.trabajadores_activos}
          icon={<IconPeople />}
          iconBg="bg-purple-50"
          loading={loading}
        />
        <KpiCard
          label="Tasa finalización"
          value={kpis.tasa_finalizacion != null ? `${kpis.tasa_finalizacion}` : '—'}
          suffix="%"
          current={kpis.tasa_finalizacion}
          prev={kpisPrev.tasa_finalizacion}
          icon={<IconRate />}
          iconBg="bg-brand-50"
          loading={loading}
        />
        <KpiCard
          label="Prom. horas/día"
          value={kpis.horas_por_dia_promedio != null ? Number(kpis.horas_por_dia_promedio).toFixed(1) : '—'}
          suffix="h"
          current={kpis.horas_por_dia_promedio}
          prev={kpisPrev.horas_por_dia_promedio}
          icon={<IconTrend />}
          iconBg="bg-gold-400/10"
          loading={loading}
        />
      </div>

      {/* ── Tendencia diaria (full width) ── */}
      <TendenciaChart data={tendencia} loading={loading} />

      {/* ── Ranking + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingList data={topTrabajadores} loading={loading} />
        <DonutCategoria data={porCategoria} loading={loading} />
      </div>

      {/* ── Heatmap + Centro de costo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HeatmapDia data={heatmap} loading={loading} />
        <CcTable data={porCc} loading={loading} />
      </div>

      {/* ── Alertas (full width) ── */}
      <TablaAlertas data={alertas} loading={loading} />
    </div>
  )
}
