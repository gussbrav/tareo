import { useMemo } from 'react'

import { Icon } from './Icons.jsx'

/**
 * Sidebar del admin — estático, con íconos y agrupación por sección.
 * (Se quitó el drag&drop: en esta sección el orden es fijo.)
 *
 * Props:
 *   tabs   : [{ id, label, group, icon }]
 *   active : id
 *   onSelect(id)
 */
export default function AdminSidebar({ tabs, active, onSelect }) {
  const grouped = useMemo(() => {
    const g = []
    let current = null
    for (const t of tabs) {
      if (!current || current.name !== t.group) {
        current = { name: t.group, items: [] }
        g.push(current)
      }
      current.items.push(t)
    }
    return g
  }, [tabs])

  return (
    <aside className="space-y-5">
      {grouped.map((g) => (
        <div key={g.name}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 px-2 mb-1.5">
            {g.name}
          </div>
          <div className="space-y-0.5">
            {g.items.map((t) => {
              const isActive = active === t.id
              const IconCmp = t.icon || Icon.Folder
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-left
                              transition-colors
                              ${isActive
                                ? 'bg-brand-50 text-brand-700 font-medium'
                                : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <IconCmp className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                  <span className="truncate">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </aside>
  )
}
