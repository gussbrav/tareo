/**
 * SearchableSelect — combobox premium con búsqueda inline.
 *
 * Reemplaza al <select> nativo cuando querés:
 *  - Filtrar por texto entre muchas opciones (áreas, proyectos, CC, etc.)
 *  - Estado de carga sin flicker (spinner en el trigger, opciones ocultas)
 *  - Estado vacío con mensaje contextual
 *  - Navegación por teclado (↑↓ para moverse, Enter para elegir, Esc para cerrar)
 *  - Cierre por click afuera
 *
 * Diseñado para mimetizar la clase .input del design system — mismo alto,
 * bordes, radios, focus ring. Sin dependencias externas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Icon } from './Icons.jsx'

function MiniSpinner({ className = 'w-3.5 h-3.5' }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`${className} inline-block border-2 border-slate-200 border-t-brand-500 rounded-full animate-spin`}
    />
  )
}

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  getLabel = (o) => o?.display_name || o?.nbrcompleto || o?.nombre || '',
  getValue = (o) => o?.id,
  placeholder = 'Selecciona…',
  disabled = false,
  loading = false,
  emptyText = 'Sin opciones',
  disabledText, // texto opcional para trigger cuando disabled y NO hay value
  required = false,
  id,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const selected = useMemo(
    () => options.find((o) => getValue(o) === value) || null,
    [options, value, getValue],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => getLabel(o).toLowerCase().includes(q))
  }, [options, query, getLabel])

  // Reset del highlight cuando cambian las opciones filtradas
  useEffect(() => {
    setHighlight(0)
  }, [query, options])

  // Focus del input de búsqueda al abrir
  useEffect(() => {
    if (open) {
      // pequeño delay para que el DOM ya haya montado el input
      const t = setTimeout(() => inputRef.current?.focus(), 10)
      return () => clearTimeout(t)
    }
    setQuery('')
  }, [open])

  // Click afuera → cerrar
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Scroll del highlight visible en la lista
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  const commit = useCallback(
    (opt) => {
      if (!opt) return
      onChange(getValue(opt))
      setOpen(false)
    },
    [onChange, getValue],
  )

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commit(filtered[highlight])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const triggerLabel = selected
    ? getLabel(selected)
    : disabled && disabledText
      ? disabledText
      : placeholder
  const triggerIsPlaceholder = !selected

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required}
        aria-busy={loading}
        className={`input w-full flex items-center justify-between gap-2 text-left ${
          disabled ? 'opacity-70 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
        } ${loading ? 'cursor-wait' : ''}`}
      >
        <span className={`truncate ${triggerIsPlaceholder ? 'text-slate-400' : 'text-slate-900'}`}>
          {triggerLabel}
        </span>
        <span className="flex items-center gap-1 shrink-0 text-slate-400">
          {loading && <MiniSpinner />}
          <Icon.ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && !disabled && (
        <div
          className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-elevated overflow-hidden"
          role="listbox"
        >
          {/* Barra de búsqueda */}
          <div className="relative border-b border-slate-100">
            <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Lista */}
          <div ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500 text-center">
                {options.length === 0 ? emptyText : 'Sin coincidencias'}
              </p>
            ) : (
              filtered.map((o, i) => {
                const v = getValue(o)
                const isSelected = v === value
                const isHighlighted = i === highlight
                return (
                  <button
                    key={v}
                    type="button"
                    data-idx={i}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => commit(o)}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                      isHighlighted ? 'bg-brand-50 text-brand-900' : 'text-slate-800'
                    } ${isSelected ? 'font-medium' : ''}`}
                  >
                    <span className="truncate">{getLabel(o)}</span>
                    {isSelected && <Icon.Check className="w-4 h-4 text-brand-600 shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
