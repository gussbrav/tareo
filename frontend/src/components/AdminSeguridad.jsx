/**
 * AdminSeguridad — cambio de contraseña del usuario logueado.
 * Estilo espejo del CRM Azoramind (Configuración → Mi cuenta → Seguridad).
 * Cualquier rol (admin / supervisor / trabajador) puede usarlo — no requiere permisos extra.
 */
import { useMemo, useState } from 'react'

import { authApi } from '../api/auth'
import { Icon } from './admin/Icons.jsx'

const MIN_LEN = 8

function validate(pw) {
  if (pw.length < MIN_LEN) return `Mínimo ${MIN_LEN} caracteres.`
  if (!/[A-Z]/.test(pw)) return 'Debe incluir al menos una letra mayúscula.'
  if (!/[0-9]/.test(pw)) return 'Debe incluir al menos un número.'
  return null
}

export default function AdminSeguridad() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const complexity = useMemo(() => (next ? validate(next) : null), [next])

  const canSubmit = current && next && confirm && !complexity && next === confirm

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setMsg('')
    if (next !== confirm) {
      setError('La nueva contraseña y su confirmación no coinciden.')
      return
    }
    if (complexity) {
      setError(complexity)
      return
    }
    setSaving(true)
    try {
      await authApi.changePassword(current, next)
      setCurrent(''); setNext(''); setConfirm('')
      setMsg('Contraseña actualizada correctamente.')
      setTimeout(() => setMsg(''), 3500)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo actualizar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-amber-50 flex items-center justify-center shrink-0">
            <Icon.Key className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Seguridad</h2>
            <p className="text-sm text-slate-500">Contraseña y seguridad de tu cuenta.</p>
          </div>
        </div>
      </div>

      <form className="card space-y-4 max-w-lg" onSubmit={submit}>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Cambiar contraseña</h3>
          <p className="text-xs text-slate-500 mt-0.5">Actualiza la contraseña de tu cuenta.</p>
        </div>

        <div>
          <label className="label">Contraseña actual <span className="text-red-500">*</span></label>
          <input
            type="password"
            className="input"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="label">Nueva contraseña <span className="text-red-500">*</span></label>
          <input
            type="password"
            className="input"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            autoComplete="new-password"
          />
          <p className={`text-xs mt-1 ${complexity ? 'text-amber-600' : 'text-slate-400'}`}>
            {complexity || `Al menos ${MIN_LEN} caracteres, con una mayúscula y un número.`}
          </p>
        </div>

        <div>
          <label className="label">Confirmar nueva contraseña <span className="text-red-500">*</span></label>
          <input
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          {confirm && next !== confirm && (
            <p className="text-xs text-amber-600 mt-1">Las contraseñas no coinciden.</p>
          )}
        </div>

        {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
        {msg && <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{msg}</div>}

        <div className="pt-2 border-t border-slate-100">
          <button type="submit" className="btn-primary btn-sm" disabled={!canSubmit || saving}>
            {saving ? 'Actualizando…' : 'Actualizar contraseña'}
          </button>
        </div>
      </form>
    </div>
  )
}
