/**
 * KpiCard — tarjeta de KPI con valor grande, delta vs período anterior e ícono.
 * No depende de librerías externas de iconos.
 */

function ArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block">
      <path d="M7 11V3M7 3L3 7M7 3L11 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block">
      <path d="M7 3V11M7 11L3 7M7 11L11 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * @param {object} props
 * @param {string}  props.label         - Etiqueta de la métrica
 * @param {string|number} props.value   - Valor actual formateado
 * @param {number}  [props.prev]        - Valor del período anterior (mismo tipo que value numérico)
 * @param {number}  [props.current]     - Valor numérico actual (para calcular delta)
 * @param {boolean} [props.invertDelta] - Si true, sube = rojo (ej: en proceso)
 * @param {string}  [props.suffix]      - Sufijo del valor (ej: "h", "%")
 * @param {ReactNode} [props.icon]      - SVG inline
 * @param {string}  [props.iconBg]      - Clase tailwind de fondo del ícono
 * @param {boolean} [props.loading]     - Mostrar skeleton
 */
export default function KpiCard({
  label,
  value,
  prev,
  current,
  invertDelta = false,
  suffix = '',
  icon,
  iconBg = 'bg-brand-100',
  loading = false,
}) {
  // Calcula delta porcentual
  let delta = null
  let deltaPositive = null
  if (typeof current === 'number' && typeof prev === 'number' && prev !== 0) {
    delta = ((current - prev) / prev) * 100
    deltaPositive = invertDelta ? delta < 0 : delta > 0
  } else if (typeof current === 'number' && typeof prev === 'number' && prev === 0 && current > 0) {
    delta = 100
    deltaPositive = !invertDelta
  }

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-3 bg-slate-200 rounded w-24 mb-4" />
        <div className="h-8 bg-slate-200 rounded w-20 mb-3" />
        <div className="h-3 bg-slate-200 rounded w-16" />
      </div>
    )
  }

  return (
    <div className="card hover:shadow-elevated transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {icon && (
          <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${iconBg}`}>
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-900 tabular-nums">
          {typeof value === 'number' ? value.toLocaleString('es-PE') : value}
        </span>
        {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      </div>

      <div className="mt-2 h-5">
        {delta !== null ? (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${
              deltaPositive ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            {deltaPositive ? <ArrowUp /> : <ArrowDown />}
            {Math.abs(delta).toFixed(1)}% vs período anterior
          </span>
        ) : (
          <span className="text-xs text-slate-400">Sin comparativa</span>
        )}
      </div>
    </div>
  )
}
