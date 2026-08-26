import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuthStore } from '../store/auth'
import { configApi } from '../api/config'
import ActiveProjectPicker from './ActiveProjectPicker.jsx'
import { Icon } from './admin/Icons.jsx'
import UserMenu from './UserMenu.jsx'

const navBase =
  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors'
const navActive = 'bg-slate-100 text-slate-900'
const navInactive = 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'

export default function AppShell() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [brand, setBrand] = useState({ logo_url: '', company_name: 'Tareo' })

  useEffect(() => {
    const load = () => configApi.publicSettings().then(setBrand).catch(() => {})
    load()
    window.addEventListener('tareo:brand-updated', load)
    return () => window.removeEventListener('tareo:brand-updated', load)
  }, [])

  const canCreate = user?.role === 'admin' || user?.role === 'supervisor'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Left: brand + destinos */}
          <div className="flex items-center gap-6 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.company_name || 'Logo'}
                  className="h-8 w-auto max-w-[140px] object-contain"
                />
              ) : (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-brand-600 text-white font-bold">
                  T
                </span>
              )}
              <span className="font-semibold text-slate-900">Tareo</span>
              {brand.company_name && (
                <span className="text-xs text-slate-400 hidden sm:inline">
                  · {brand.company_name}
                </span>
              )}
            </div>
            <nav className="hidden sm:flex items-center gap-0.5">
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `${navBase} ${isActive ? navActive : navInactive}`}
              >
                Dashboard
              </NavLink>
              <NavLink to="/tareo" className={({ isActive }) => `${navBase} ${isActive ? navActive : navInactive}`}>
                Tareo
              </NavLink>
              <NavLink to="/agenda" className={({ isActive }) => `${navBase} ${isActive ? navActive : navInactive}`}>
                Agenda
              </NavLink>
            </nav>
            {/* Picker de proyecto activo — solo se muestra si el user tiene 2+ */}
            <ActiveProjectPicker />
          </div>

          {/* Right: CTA + user menu */}
          <div className="flex items-center gap-2 shrink-0">
            {canCreate && (
              <button
                onClick={() => navigate('/actividades/nueva')}
                className="btn-primary btn-sm hidden sm:inline-flex"
              >
                <Icon.Plus className="w-4 h-4" />
                Nueva actividad
              </button>
            )}
            <UserMenu />
          </div>
        </div>

        {/* nav móvil */}
        <div className="sm:hidden border-t border-slate-100 px-3 py-2 flex items-center gap-2 overflow-x-auto">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `${navBase} shrink-0 ${isActive ? navActive : navInactive}`}
          >
            Dashboard
          </NavLink>
          <NavLink to="/tareo" className={({ isActive }) => `${navBase} shrink-0 ${isActive ? navActive : navInactive}`}>
            Tareo
          </NavLink>
          <NavLink to="/agenda" className={({ isActive }) => `${navBase} shrink-0 ${isActive ? navActive : navInactive}`}>
            Agenda
          </NavLink>
          {canCreate && (
            <button
              onClick={() => navigate('/actividades/nueva')}
              className="btn-primary btn-sm shrink-0 ml-auto"
            >
              <Icon.Plus className="w-4 h-4" />
              Nueva
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}
