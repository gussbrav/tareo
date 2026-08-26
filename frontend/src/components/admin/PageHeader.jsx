import { Icon } from './Icons.jsx'

/**
 * Header consistente de sección admin:
 * - título + subtítulo/contador
 * - buscador opcional (controlado)
 * - CTA principal opcional
 */
export default function PageHeader({
  title,
  count,
  countLabel,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  primaryLabel,
  onPrimary,
  primaryIcon: PrimaryIcon = Icon.Plus,
}) {
  return (
    <div className="toolbar">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h2>
        {typeof count === 'number' && (
          <p className="text-xs text-slate-500 mt-0.5">
            {count} {countLabel}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onSearchChange && (
          <div className="relative">
            <Icon.Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              className="input input-sm pl-8 w-56"
              placeholder={searchPlaceholder}
              value={search || ''}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}
        {primaryLabel && (
          <button className="btn-primary btn-sm" onClick={onPrimary}>
            <PrimaryIcon className="w-4 h-4" />
            {primaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
