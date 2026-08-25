/**
 * DonutCategoria — Distribución de horas por categoría de trabajador.
 * Donut chart de recharts + leyenda inline ordenada.
 */
import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const PALETTE = [
  '#1E40AF', '#3B65F5', '#6089FA', '#93B4FD',
  '#D9A518', '#F5C542', '#B8860B', '#BFD3FE',
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-elevated px-3 py-2 text-sm">
      <p className="font-semibold text-slate-800">{d.categoria}</p>
      <p className="text-slate-600">
        <span className="font-medium text-slate-900">{Number(d.horas).toFixed(1)} h</span>
        {' '}· {d.pct_total?.toFixed(1)}%
      </p>
      <p className="text-xs text-slate-400">{d.actividades} actividades</p>
    </div>
  )
}

/**
 * @param {object} props
 * @param {Array}   props.data    - [{categoria, horas, actividades, pct_total}]
 * @param {boolean} [props.loading]
 */
export default function DonutCategoria({ data = [], loading = false }) {
  const dataConColor = useMemo(
    () => data.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] })),
    [data],
  )

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-40 mb-4" />
        <div className="h-48 bg-slate-100 rounded" />
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="card flex flex-col items-center justify-center h-60 gap-3">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#EFF4FF" />
          <circle cx="24" cy="24" r="12" stroke="#6089FA" strokeWidth="2" strokeDasharray="4 4" />
        </svg>
        <p className="text-slate-400 text-sm">Sin datos de categorías</p>
      </div>
    )
  }

  const totalHoras = data.reduce((acc, d) => acc + (d.horas || 0), 0)

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900">Distribución por categoría</h3>
        <p className="text-xs text-slate-400 mt-0.5">Horas finalizadas</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-44 h-44 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataConColor}
                dataKey="horas"
                nameKey="categoria"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                strokeWidth={0}
              >
                {dataConColor.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-slate-900">{totalHoras.toFixed(0)}h</span>
            <span className="text-xs text-slate-400">total</span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-2">
          {dataConColor.map((d) => (
            <div key={d.categoria} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="flex-1 text-xs text-slate-700 truncate" title={d.categoria}>{d.categoria}</span>
              <span className="text-xs font-semibold text-slate-800 tabular-nums">{Number(d.horas).toFixed(1)}h</span>
              <span className="text-xs text-slate-400 w-8 text-right tabular-nums">{d.pct_total?.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
