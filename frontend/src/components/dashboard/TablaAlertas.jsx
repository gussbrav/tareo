/**
 * TablaAlertas — Actividades en estado "iniciado" con más de 3 días de antigüedad.
 * Alerta operacional: requieren atención inmediata.
 */

function BadgeDias({ dias }) {
  const color =
    dias >= 14 ? 'bg-red-100 text-red-700' :
    dias >= 7  ? 'bg-amber-100 text-amber-700' :
                 'bg-orange-100 text-orange-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {dias}d
    </span>
  )
}

/**
 * @param {object} props
 * @param {Array}   props.data    - [{trabajador, fecha, actividad, centro_costo, dias_pendiente}]
 * @param {boolean} [props.loading]
 */
export default function TablaAlertas({ data = [], loading = false }) {
  if (loading) {
    return (
      <div className="card animate-pulse space-y-3">
        <div className="h-4 bg-slate-200 rounded w-48 mb-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 bg-slate-100 rounded" />
        ))}
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="card flex items-center gap-4 py-5">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#10b981" strokeWidth="1.5" />
            <path d="M6.5 10.5L9 13L13.5 8" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-medium text-slate-900">Sin actividades pendientes</p>
          <p className="text-xs text-slate-400 mt-0.5">No hay registros con más de 3 días en estado iniciado</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#ef4444" strokeWidth="1.5" />
            <path d="M7 4V7.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.75" fill="#ef4444" />
          </svg>
        </span>
        <div>
          <h3 className="font-semibold text-slate-900">Requieren atención</h3>
          <p className="text-xs text-slate-400">Actividades en estado iniciado &gt; 3 días</p>
        </div>
        <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700">
          {data.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Trabajador
              </th>
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Fecha
              </th>
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hidden md:table-cell">
                Actividad
              </th>
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hidden sm:table-cell">
                Centro de costo
              </th>
              <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pendiente
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="py-2.5 pr-3 font-medium text-slate-800 whitespace-nowrap">
                  {r.trabajador}
                </td>
                <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">
                  {r.fecha}
                </td>
                <td className="py-2.5 pr-3 text-slate-600 max-w-xs truncate hidden md:table-cell" title={r.actividad}>
                  {r.actividad}
                </td>
                <td className="py-2.5 pr-3 text-slate-500 hidden sm:table-cell whitespace-nowrap">
                  {r.centro_costo}
                </td>
                <td className="py-2.5 text-right">
                  <BadgeDias dias={r.dias_pendiente} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
