/**
 * TendenciaChart — Área chart de tendencia diaria de horas y actividades.
 * Usa recharts (ya instalado en el proyecto).
 */
import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function formatFecha(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-elevated px-3 py-2 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-medium text-slate-900">
            {p.dataKey === 'horas' ? `${Number(p.value).toFixed(1)} h` : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * @param {object} props
 * @param {Array}   props.data     - [{fecha, horas, actividades, finalizadas}]
 * @param {boolean} [props.loading]
 */
export default function TendenciaChart({ data = [], loading = false }) {
  const formatted = useMemo(
    () => data.map((d) => ({ ...d, fechaLabel: formatFecha(d.fecha) })),
    [data],
  )

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-40 mb-4" />
        <div className="h-52 bg-slate-100 rounded" />
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="card flex flex-col items-center justify-center h-64 gap-3">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#EFF4FF" />
          <path d="M10 36L20 24L28 30L38 14" stroke="#6089FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="38" cy="14" r="3" fill="#1E40AF" />
        </svg>
        <p className="text-slate-400 text-sm">Sin actividad en el rango seleccionado</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Tendencia diaria</h3>
          <p className="text-xs text-slate-400 mt-0.5">Horas registradas por día</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-brand-600 rounded" />
            Horas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-gold-500 rounded" />
            Actividades
          </span>
        </div>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradHoras" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1E40AF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradAct" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D9A518" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#D9A518" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="fechaLabel"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="horas"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}h`}
            />
            <YAxis
              yAxisId="act"
              orientation="right"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="horas"
              type="monotone"
              dataKey="horas"
              name="Horas"
              stroke="#1E40AF"
              strokeWidth={2}
              fill="url(#gradHoras)"
              dot={false}
              activeDot={{ r: 4, fill: '#1E40AF' }}
            />
            <Area
              yAxisId="act"
              type="monotone"
              dataKey="actividades"
              name="Actividades"
              stroke="#D9A518"
              strokeWidth={2}
              fill="url(#gradAct)"
              dot={false}
              activeDot={{ r: 4, fill: '#D9A518' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
