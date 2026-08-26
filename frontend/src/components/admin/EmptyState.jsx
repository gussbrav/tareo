import { Icon } from './Icons.jsx'

export default function EmptyState({
  icon: IconCmp = Icon.Inbox,
  title = 'Sin registros',
  message,
  actionLabel,
  onAction,
}) {
  return (
    <div className="text-center py-14 px-6">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <IconCmp className="w-6 h-6" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-slate-900">{title}</h3>
      {message && <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{message}</p>}
      {actionLabel && onAction && (
        <button className="btn-primary btn-sm mt-4" onClick={onAction}>
          <Icon.Plus className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}
