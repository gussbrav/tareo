import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import { useAuthStore } from '../store/auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { accessToken, setTokens } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (accessToken) {
    return <Navigate to={location.state?.from?.pathname || '/'} replace />
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', { email, password })
      setTokens(data.access_token, data.refresh_token, data.user)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || 'No se pudo iniciar sesión. Intenta de nuevo.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-600 text-white text-2xl font-bold shadow-elevated">
            T
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">Tareo</h1>
          <p className="text-sm text-slate-500">Control de actividades · Azoramind</p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-4">
          © {new Date().getFullYear()} Azoramind
        </p>
      </div>
    </div>
  )
}
