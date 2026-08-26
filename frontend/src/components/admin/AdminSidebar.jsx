import { useEffect, useMemo, useState } from 'react'

import { Icon } from './Icons.jsx'

const STORAGE_KEY = 'tareo:admin-tabs-order-v1'

/**
 * Sidebar del admin con drag & drop (HTML5 nativo, sin dep).
 * El orden se persiste por-usuario en localStorage. "Restaurar" vuelve al default.
 * Los items se pueden reordenar libremente entre grupos.
 *
 * Props:
 *   tabs   : [{ id, label, group, icon }]
 *   active : id
 *   onSelect(id)
 */
export default function AdminSidebar({ tabs, active, onSelect }) {
  const [order, setOrder] = useState(() => loadOrder(tabs))
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  }, [order])

  const ordered = useMemo(() => {
    const byId = Object.fromEntries(tabs.map((t) => [t.id, t]))
    // items en el order guardado, más los nuevos al final
    const known = order.filter((id) => byId[id])
    const missing = tabs.map((t) => t.id).filter((id) => !known.includes(id))
    return [...known, ...missing].map((id) => byId[id])
  }, [tabs, order])

  const grouped = useMemo(() => {
    const g = []
    let current = null
    for (const t of ordered) {
      if (!current || current.name !== t.group) {
        current = { name: t.group, items: [] }
        g.push(current)
      }
      current.items.push(t)
    }
    return g
  }, [ordered])

  const onDragStart = (e, id) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    // firefox necesita algo en dataTransfer
    e.dataTransfer.setData('text/plain', id)
  }

  const onDragOver = (e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== overId) setOverId(id)
  }

  const onDrop = (e, targetId) => {
    e.preventDefault()
    if (!dragId || dragId === targetId) {
      setDragId(null)
      setOverId(null)
      return
    }
    const currentIds = ordered.map((t) => t.id)
    const fromIdx = currentIds.indexOf(dragId)
    const toIdx = currentIds.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...currentIds]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setOrder(next)
    setDragId(null)
    setOverId(null)
  }

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setOrder(tabs.map((t) => t.id))
  }

  const isCustomOrder = JSON.stringify(order) !== JSON.stringify(tabs.map((t) => t.id))

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
              const isOver = overId === t.id && dragId !== t.id
              const IconCmp = t.icon || Icon.Folder
              return (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, t.id)}
                  onDragOver={(e) => onDragOver(e, t.id)}
                  onDrop={(e) => onDrop(e, t.id)}
                  onDragEnd={() => { setDragId(null); setOverId(null) }}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm
                              transition-colors select-none
                              ${isActive
                                ? 'bg-brand-50 text-brand-700 font-medium'
                                : 'text-slate-700 hover:bg-slate-100'}
                              ${isOver ? 'ring-2 ring-brand-400/60 ring-offset-1' : ''}
                              ${dragId === t.id ? 'opacity-40' : ''}`}
                  onClick={() => onSelect(t.id)}
                >
                  <span
                    className="text-slate-300 group-hover:text-slate-400 cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Arrastrar para reordenar"
                  >
                    <Icon.Drag className="w-3.5 h-3.5" />
                  </span>
                  <IconCmp className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                  <span className="truncate">{t.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {isCustomOrder && (
        <div className="pt-2 border-t border-slate-100">
          <button
            className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1.5 px-2"
            onClick={reset}
          >
            <Icon.Refresh className="w-3.5 h-3.5" />
            Restaurar orden
          </button>
        </div>
      )}
    </aside>
  )
}

function loadOrder(tabs) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return tabs.map((t) => t.id)
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return tabs.map((t) => t.id)
    return parsed
  } catch {
    return tabs.map((t) => t.id)
  }
}
