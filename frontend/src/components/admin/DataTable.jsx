import { useMemo, useState } from 'react'

import EmptyState from './EmptyState.jsx'
import { Icon } from './Icons.jsx'

/**
 * Tabla premium con:
 * - sticky header
 * - orden por columna (columns[i].sortable = true)
 * - filtro por texto (search + searchKeys)
 * - render custom por celda (columns[i].render)
 * - hover row
 * - empty state
 * - acciones por fila (rowActions)
 * - drag & drop opcional (onReorder) — deshabilitado si hay orden por columna activo
 *   o si hay búsqueda (para evitar arrastrar sobre un subset filtrado)
 *
 * Props extra:
 *   onReorder(newItems)  — si se pasa, activa drag&drop en las filas
 */
export default function DataTable({
  items = [],
  columns,
  rowKey = (r) => r.id,
  loading = false,
  search = '',
  searchKeys = [],
  rowActions,
  rowInactive,
  empty = {},
  onReorder,
}) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  const filtered = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
    )
  }, [items, search, searchKeys])

  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return filtered
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = a[sort.key]
      const vb = b[sort.key]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      if (typeof va === 'boolean' && typeof vb === 'boolean') return (Number(va) - Number(vb)) * dir
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * dir
    })
  }, [filtered, sort, columns])

  // Drag&drop está activo sólo cuando: no hay orden por columna, no hay búsqueda,
  // y el parent pasa onReorder. Reordenar sobre un subset filtrado sería confuso.
  const dragEnabled = !!onReorder && !sort.key && !search

  const toggleSort = (key) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  }

  const SortIcon = ({ colKey }) => {
    if (sort.key !== colKey) return <Icon.ArrowsUpDown className="w-3 h-3 opacity-40" />
    return sort.dir === 'asc'
      ? <Icon.ArrowUp className="w-3 h-3 text-brand-600" />
      : <Icon.ArrowDown className="w-3 h-3 text-brand-600" />
  }

  const onDragStart = (e, id) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }
  const onDragOver = (e, id) => {
    if (!dragEnabled) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== overId) setOverId(id)
  }
  const onDrop = (e, targetId) => {
    if (!dragEnabled) return
    e.preventDefault()
    setOverId(null)
    if (!dragId || dragId === targetId) return setDragId(null)
    const currentIds = sorted.map((r) => rowKey(r))
    const fromIdx = currentIds.indexOf(dragId)
    const toIdx = currentIds.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) return setDragId(null)
    const nextIds = [...currentIds]
    const [moved] = nextIds.splice(fromIdx, 1)
    nextIds.splice(toIdx, 0, moved)
    const byId = Object.fromEntries(sorted.map((r) => [rowKey(r), r]))
    onReorder(nextIds.map((id) => byId[id]))
    setDragId(null)
  }

  if (loading) {
    return (
      <div className="card-flush">
        <div className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="card-flush">
        <EmptyState {...empty} />
      </div>
    )
  }

  const alignClass = (a) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : '')

  return (
    <div className="card-flush overflow-x-auto">
      <table className="table-premium">
        <thead>
          <tr>
            {dragEnabled && <th className="w-8 !px-2" aria-label="Reordenar" />}
            {columns.map((c) => (
              <th key={c.key} className={`${alignClass(c.align)} ${c.className || ''}`}>
                {c.sortable ? (
                  <button className="th-sort" onClick={() => toggleSort(c.key)}>
                    {c.label}
                    <SortIcon colKey={c.key} />
                  </button>
                ) : c.label}
              </th>
            ))}
            {rowActions && <th className="text-right w-[1%] whitespace-nowrap">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const inactive = rowInactive?.(row)
            const id = rowKey(row)
            const isDragging = dragId === id
            const isOver = overId === id && dragId !== id
            return (
              <tr
                key={id}
                draggable={dragEnabled}
                onDragStart={dragEnabled ? (e) => onDragStart(e, id) : undefined}
                onDragOver={dragEnabled ? (e) => onDragOver(e, id) : undefined}
                onDrop={dragEnabled ? (e) => onDrop(e, id) : undefined}
                onDragEnd={dragEnabled ? () => { setDragId(null); setOverId(null) } : undefined}
                className={`${inactive ? 'row-inactive' : ''}
                            ${isDragging ? 'opacity-40' : ''}
                            ${isOver ? 'ring-2 ring-brand-400 ring-inset' : ''}`}
              >
                {dragEnabled && (
                  <td className="!px-2 w-8 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                    <Icon.Drag className="w-4 h-4" />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={`${alignClass(c.align)} ${c.className || ''}`}>
                    {c.render ? c.render(row) : renderDefault(row[c.key])}
                  </td>
                ))}
                {rowActions && (
                  <td className="text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {rowActions(row)}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {onReorder && !dragEnabled && (
        <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100 bg-slate-50/50">
          {sort.key
            ? 'Quitá el orden por columna para poder reordenar arrastrando.'
            : 'Limpiá el buscador para poder reordenar arrastrando.'}
        </p>
      )}
    </div>
  )
}

function renderDefault(v) {
  if (v == null || v === '') return <span className="text-slate-400">—</span>
  if (typeof v === 'boolean') {
    return v
      ? <Icon.Check className="w-4 h-4 text-emerald-600 inline-block" />
      : <span className="text-slate-400">—</span>
  }
  return String(v)
}
