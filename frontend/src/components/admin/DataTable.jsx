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
 *
 * Props:
 *   items         : array de filas
 *   columns       : [{ key, label, sortable?, render?, className?, align? }]
 *   rowKey        : (row) => string  (default: row.id)
 *   loading       : bool
 *   search        : string
 *   searchKeys    : array de keys sobre las que filtra
 *   rowActions    : (row) => ReactNode
 *   rowInactive   : (row) => bool  (aplica opacidad)
 *   empty         : props para EmptyState { title, message, actionLabel, onAction }
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
}) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

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
            return (
              <tr key={rowKey(row)} className={inactive ? 'row-inactive' : ''}>
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
