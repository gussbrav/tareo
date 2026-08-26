/**
 * AceptarInvitacion — pantalla pública donde el usuario invitado setea
 * su contraseña. Sin auth. Auto-login al aceptar.
 *
 * URL: /aceptar/:token — el token viene del email de invitación.
 */
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { invitacionesApi } from '../api/invitaciones'
import { useAuthStore } from '../store/auth'

const MIN_LEN = 8

function validate(pw) {
  if (pw.length < MIN_LEN) return `Mínimo ${MIN_LEN} caracteres.`
  if (!/[A-Z]/.test(pw)) return 'Debe incluir al menos una letra mayúscula.'
  if (!/[0-9]/.test(pw)) return 'Debe incluir al menos un número.'
  return null
}

export default function AceptarInvitacion() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { accessToken, setTokens } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState(null)
  const [error, setError] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const complexity = useMemo(() => (password ? validate(password) : null), [password])
  const canSubmit = password && confirm && !complexity && password === confirm

  useEffect(() => {
    if (!token) { setError('Link inválido.'); setLoading(false); return }
    invitacionesApi.validate(token)
      .then((inv) => {
        setInvitation(inv)
        if (!inv.valid) {
          setError('Este link ya no está activo. Pedile al administrador que te envíe uno nuevo.')
        }
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || 'No pudimos validar el link. Verificá que sea correcto.'
        setError(detail)
      })
      .finally(() => setLoading(false))
  }, [token])

  // Si el usuario ya está logueado, no tiene sentido aceptar una invitación.
  if (accessToken && !saving) {
    return <Navigate to="/" replace />
  }

  const submit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    if (complexity) { setSubmitError(complexity); return }
    if (password !== confirm) { setSubmitError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try {
      const { access_token, refresh_token, user } = await invitacionesApi.accept(token, password)
      setTokens(access_token, refresh_token, user)
      navigate('/', { replace: true })
    } catch (err) {
      setSubmitError(err.response?.data?.detail || 'No se pudo activar la cuenta.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-600 text-white text-2xl font-bold shadow-elevated">
            T
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">Activá tu cuenta</h1>
          <p className="text-sm text-slate-500">Tareo · Azoramind</p>
        </div>

        {loading ? (
          <div className="card text-center text-sm text-slate-500 py-8">
            Validando invitación…
          </div>
        ) : error ? (
          <div className="card">
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-3">
              {error}
            </div>
            <button
              className="btn-secondary w-full mt-4"
              onClick={() => navigate('/login')}
            >
              Ir a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <p className="text-sm text-slate-600">
                Vas a activar la cuenta de{' '}
                <strong className="text-slate-900">{invitation.email}</strong>
                {invitation.first_name && (
                  <>
                    {' '}({invitation.first_name} {invitation.last_name || ''})
                  </>
                )}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Elegí una contraseña propia. Vas a usarla para entrar la próxima vez.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="pw">Contraseña</label>
              <input
                id="pw"
                type="password"
                autoComplete="new-password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
              />
              <p className={`text-xs mt-1 ${complexity ? 'text-amber-600' : 'text-slate-400'}`}>
                {complexity || `Al menos ${MIN_LEN} caracteres, con una mayúscula y un número.`}
              </p>
            </div>

            <div>
              <label className="label" htmlFor="pw2">Confirmar contraseña</label>
              <input
                id="pw2"
                type="password"
                autoComplete="new-password"
                required
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
              />
              {confirm && password !== confirm && (
                <p className="text-xs text-amber-600 mt-1">Las contraseñas no coinciden.</p>
              )}
            </div>

            {submitError && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                {submitError}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={!canSubmit || saving}>
              {saving ? 'Activando…' : 'Activar cuenta y entrar'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-400 mt-4">
          © {new Date().getFullYear()} Azoramind
        </p>
      </div>
    </div>
  )
}
