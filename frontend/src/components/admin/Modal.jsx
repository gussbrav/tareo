import { useEffect } from 'react'

import { Icon } from './Icons.jsx'

/**
 * Modal centrado, sobrio. Cierra con Esc o click en backdrop.
 */
export default function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`bg-white rounded-xl shadow-elevated w-full ${maxWidth} border border-slate-200 overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="icon-btn -mr-1"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <Icon.X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
