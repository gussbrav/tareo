/**
 * CcTable — Tabla detallada de horas por centro de costo con barra mini.
 */

const PALETTE = [
  '#1E40AF', '#3B65F5', '#6089FA', '#93B4FD',
  '#D9A518', '#F5C542', '#B8860B', '#BFD3FE',
]

/**
 * @param {object} props
 * @param {Array}   props.data    - [{centro_costo, codigo, actividades, horas, pct_total}]
 * @param {boolean} [props.loading]
 */
export default function CcTable({ data = [], loading = false }) {
  if (loading) {
    return (
      <div className="card animate-pulse space-y-3">
        <div className="h-4 bg-slate-200 rounded w-48 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 bg-slate-100 rounded" />
        ))}
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="card flex flex-col items-center justify-center h-48 gap-3">
        <p className="text-slate-400 text-sm">Sin datos de centros de costo</p>
      </div>
    )
  }

  const maxHoras = data[0]?.horas || 1

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900">Centro de costo</h3>
        <p className="text-xs text-slate-400 mt-0.5">Horas finalizadas por área</p>
      </div>

      <div className="space-y-2.5">
        {data.map((row, i) => (
          <div key={row.centro_costo}>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="flex-1 text-xs text-slate-700 truncate" title={row.centro_costo}>
                {row.codigo ? (
                  <><span className="text-slate-400">{row.codigo}</span> · {row.centro_costo}</>
                ) : row.centro_costo}
              </span>
              <span className="text-xs font-semibold text-slate-800 tabular-nums">
                {Number(row.horas).toFixed(1)}h
              </span>
              <span className="text-xs text-slate-400 w-8 text-right tabular-nums">
                {row.pct_total?.toFixed(1)}%
              </span>
            </div>
            <div className="ml-4 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min((row.horas / maxHoras) * 100, 100)}%`,
                  backgroundColor: PALETTE[i % PALETTE.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
