/**
 * UserMenu — Avatar con dropdown en el top-right del header.
 * Reemplaza el botón "Salir" suelto: alberga "Configuración" (solo admin)
 * y "Cerrar sesión". Patrón alineado con el CRM Palma.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import { useAuthStore } from '../store/auth'

function IconGear(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.15.68.4.94.71.26.32.44.7.51 1.11L21 12a2 2 0 1 1 0 4h-.09c-.41.07-.79.25-1.11.51-.32.26-.56.58-.71.94Z" />
    </svg>
  )
}

function IconLogOut(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function IconChevron({ open }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function UserMenu() {
  const navigate = useNavigate()
  const { user, refreshToken, logout } = useAuthStore()
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handle = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    if (!open) return
    const handle = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open])

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.email?.split('@')[0] ||
    'Usuario'

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'

  const isAdmin = user?.role === 'admin'

  const handleLogout = async () => {
    setOpen(false)
    try {
      if (refreshToken) {
        await api.post('/api/auth/logout', { refresh_token: refreshToken })
      }
    } catch (_) {
      /* ignore */
    }
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de usuario, ${displayName}`}
      >
        <div className="w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
          {initials}
        </div>
        <div className="hidden sm:flex flex-col items-start leading-tight max-w-[140px]">
          <span className="text-[12px] font-semibold text-slate-800 truncate w-full">
            {displayName}
          </span>
          <span className="text-[10px] text-slate-500 capitalize truncate w-full">
            {user?.role || 'usuario'}
          </span>
        </div>
        <IconChevron open={open} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute top-full right-0 mt-2 w-64 z-50 bg-white rounded-2xl border border-slate-100 py-2 overflow-hidden shadow-[0_8px_40px_rgba(15,23,42,0.16)]"
        >
          <div className="px-4 py-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                  {displayName}
                </p>
                <span className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-50 text-brand-700 capitalize">
                  {user?.role || 'usuario'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 mb-1" />

          {isAdmin && (
            <button
              role="menuitem"
              onClick={() => { navigate('/configuracion'); setOpen(false) }}
              className="w-[calc(100%-8px)] mx-1 text-left px-3 py-2 text-[13px] flex items-center gap-2.5 rounded-lg transition-colors text-slate-700 hover:bg-slate-50"
            >
              <IconGear className="text-slate-400" />
              Configuración
            </button>
          )}

          <div className="border-t border-slate-100 my-1" />

          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-[calc(100%-8px)] mx-1 text-left px-3 py-2 text-[13px] flex items-center gap-2.5 rounded-lg transition-colors text-red-600 hover:bg-red-50"
          >
            <IconLogOut className="text-red-400" />
            Cerrar sesión
          </button>

          <div className="border-t border-slate-100 mt-1 pt-2 pb-1 px-4">
            <p className="text-[10px] text-slate-400 text-center">Azoramind Tareo v0.1.0</p>
          </div>
        </div>
      )}
    </div>
  )
}
