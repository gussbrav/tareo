/**
 * RankingList — Top 10 trabajadores por horas, con barra de progreso relativa.
 */

const COLORES_CATEGORIA = {
  Operario: '#1E40AF',
  Ayudante: '#3B65F5',
  Maestro: '#D9A518',
  Supervisor: '#B8860B',
  Administrativo: '#6089FA',
  Técnico: '#93B4FD',
  Oficial: '#BFD3FE',
}

function categoriaBadge(cat) {
  const bg = COLORES_CATEGORIA[cat]
  if (bg) {
    return (
      <span
        className="inline-block text-xs px-1.5 py-0.5 rounded font-medium text-white"
        style={{ backgroundColor: bg }}
      >
        {cat}
      </span>
    )
  }
  return (
    <span className="inline-block text-xs px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600">
      {cat}
    </span>
  )
}

/**
 * @param {object} props
 * @param {Array}   props.data    - [{trabajador, categoria, horas, actividades, pct_total}]
 * @param {boolean} [props.loading]
 */
export default function RankingList({ data = [], loading = false }) {
  if (loading) {
    return (
      <div className="card animate-pulse space-y-3">
        <div className="h-4 bg-slate-200 rounded w-40 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6 h-6 bg-slate-200 rounded-full" />
            <div className="flex-1 h-3 bg-slate-200 rounded" />
            <div className="w-10 h-3 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="card flex flex-col items-center justify-center h-64 gap-3">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#EFF4FF" />
          <circle cx="24" cy="18" r="7" stroke="#6089FA" strokeWidth="2" />
          <path d="M10 42c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="#6089FA" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-slate-400 text-sm">Sin datos de trabajadores en el rango</p>
      </div>
    )
  }

  const maxHoras = data[0]?.horas || 1

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Top trabajadores</h3>
          <p className="text-xs text-slate-400 mt-0.5">Por horas finalizadas</p>
        </div>
        <span className="text-xs text-slate-400">{data.length} mostrados</span>
      </div>

      <div className="space-y-3">
        {data.map((row, i) => (
          <div key={row.trabajador} className="group">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 text-right text-xs font-bold text-slate-400">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-slate-800 truncate" title={row.trabajador}>
                {row.trabajador}
              </span>
              <div className="hidden sm:block">{categoriaBadge(row.categoria)}</div>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                {Number(row.horas).toFixed(1)}h
              </span>
              <span className="text-xs text-slate-400 w-9 text-right tabular-nums">
                {row.pct_total?.toFixed(1)}%
              </span>
            </div>
            <div className="ml-7 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((row.horas / maxHoras) * 100, 100)}%`,
                  backgroundColor: i === 0 ? '#1E40AF' : i === 1 ? '#3B65F5' : '#93B4FD',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
