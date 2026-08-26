/**
 * KpiCard — tile compacto estilo enterprise (Stripe/Linear).
 * Label arriba, número grande, delta como chip.
 * El texto "vs período anterior" se movió a tooltip para evitar wrap.
 */

function ArrowUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className="inline-block">
      <path d="M7 11V3M7 3L3 7M7 3L11 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className="inline-block">
      <path d="M7 3V11M7 11L3 7M7 11L11 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function KpiCard({
  label,
  value,
  prev,
  current,
  invertDelta = false,
  suffix = '',
  icon,
  iconBg = 'bg-brand-50',
  loading = false,
}) {
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
      <div className="card animate-pulse !p-4">
        <div className="h-3 bg-slate-200 rounded w-20 mb-3" />
        <div className="h-7 bg-slate-200 rounded w-16 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-14" />
      </div>
    )
  }

  return (
    <div className="card !p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 truncate">
          {label}
        </p>
        {icon && (
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${iconBg}`}>
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="text-[26px] leading-none font-semibold text-slate-900 tabular-nums">
          {typeof value === 'number' ? value.toLocaleString('es-PE') : value}
        </span>
        {suffix && <span className="text-sm font-medium text-slate-400">{suffix}</span>}
      </div>

      <div className="mt-2.5 h-5 flex items-center">
        {delta !== null ? (
          <span
            title={`${deltaPositive ? '+' : ''}${delta.toFixed(1)}% vs período anterior`}
            className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded ${
              deltaPositive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {deltaPositive ? <ArrowUp /> : <ArrowDown />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">Sin comparativa</span>
        )}
      </div>
    </div>
  )
}
