import { Outlet, useNavigate } from 'react-router-dom'

import { useAuthStore } from '../store/auth'
import { api } from '../api/client'

export default function AppShell() {
  const navigate = useNavigate()
  const { user, refreshToken, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.post('/api/auth/logout', { refresh_token: refreshToken })
      }
    } catch (_) { /* ignore */ }
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-brand-600 text-white font-bold">T</span>
            <span className="font-semibold text-slate-900">Tareo</span>
            <span className="text-xs text-slate-500 hidden sm:inline">· Azoramind</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 hidden sm:inline">
              {user?.first_name || user?.email}
              <span className="ml-1 text-xs text-slate-400">({user?.role})</span>
            </span>
            <button onClick={handleLogout} className="btn-secondary">Salir</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-slate-400 py-4">
        Azoramind Tareo · v0.1.0
      </footer>
    </div>
  )
}
