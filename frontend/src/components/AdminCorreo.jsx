/**
 * AdminCorreo — configuración SMTP para envío de invitaciones y alertas.
 * Patrón del CRM Azoramind. Se accede desde Configuración → Comunicación → Correo.
 *
 * Diseño:
 *  - Solo admin puede ver/editar (guarded en backend + oculto en sidebar via roles).
 *  - Password nunca vuelve del server (solo `smtp_password_set: bool`). Si el user
 *    no re-tipea al guardar, el backend preserva la actual.
 *  - Botón "Probar envío" pide un email destino y usa la config guardada.
 */
import { useEffect, useState } from 'react'

import { correoApi } from '../api/correo'
import { useAuthStore } from '../store/auth'
import { Icon } from './admin/Icons.jsx'

export default function AdminCorreo() {
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_from: '',
    smtp_use_tls: true,
    smtp_reject_unauthorized: true,
  })
  const [passwordSet, setPasswordSet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const [testOpen, setTestOpen] = useState(false)
  const [testTo, setTestTo] = useState(user?.email || '')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    correoApi.get()
      .then((cfg) => {
        setForm({
          smtp_host: cfg.smtp_host || '',
          smtp_port: cfg.smtp_port || '587',
          smtp_user: cfg.smtp_user || '',
          smtp_password: '',
          smtp_from: cfg.smtp_from || '',
          smtp_use_tls: !!cfg.smtp_use_tls,
          smtp_reject_unauthorized: !!cfg.smtp_reject_unauthorized,
        })
        setPasswordSet(!!cfg.smtp_password_set)
      })
      .catch(() => setError('No se pudo cargar la configuración SMTP'))
      .finally(() => setLoading(false))
  }, [])

  const set = (k, v) => setForm({ ...form, [k]: v })

  const save = async () => {
    setError('')
    setMsg('')
    setSaving(true)
    try {
      const cfg = await correoApi.update(form)
      setPasswordSet(!!cfg.smtp_password_set)
      setForm((f) => ({ ...f, smtp_password: '' }))
      setMsg('Configuración de correo guardada')
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    if (!testTo) return
    setTestMsg('')
    setTestError('')
    setTesting(true)
    try {
      await correoApi.test(testTo)
      setTestMsg(`Se envió el correo de prueba a ${testTo}. Revisa la bandeja de entrada (y spam).`)
    } catch (err) {
      setTestError(err.response?.data?.detail || 'No se pudo enviar el correo de prueba')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <p className="text-slate-500 text-sm">Cargando…</p>

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-start gap-3 mb-1">
          <div className="w-10 h-10 rounded-md bg-amber-50 flex items-center justify-center shrink-0">
            <Icon.General className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Correo</h2>
            <p className="text-sm text-slate-500">Servidor SMTP para invitaciones y avisos por email.</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
      {msg && <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{msg}</div>}

      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Configuración de Correo (SMTP)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ajustes del servidor de correo para invitaciones y alertas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Dirección remitente</label>
            <input
              type="email"
              className="input"
              value={form.smtp_from}
              onChange={(e) => set('smtp_from', e.target.value)}
              placeholder="no-reply@tuempresa.com"
            />
            <p className="text-xs text-slate-400 mt-1">
              Si lo dejas vacío, se usará el mismo email del usuario SMTP.
            </p>
          </div>
          <div>
            <label className="label">Servidor SMTP</label>
            <input
              className="input"
              value={form.smtp_host}
              onChange={(e) => set('smtp_host', e.target.value)}
              placeholder="smtp.gmail.com"
            />
          </div>
          <div>
            <label className="label">Puerto</label>
            <input
              className="input"
              value={form.smtp_port}
              onChange={(e) => set('smtp_port', e.target.value)}
              placeholder="587"
            />
            <p className="text-xs text-slate-400 mt-1">
              587 para STARTTLS · 465 para SSL/TLS directo
            </p>
          </div>
          <div>
            <label className="label">Usuario SMTP</label>
            <input
              className="input"
              value={form.smtp_user}
              onChange={(e) => set('smtp_user', e.target.value)}
              placeholder="tu-cuenta@gmail.com"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Contraseña SMTP</label>
            <input
              type="password"
              className="input"
              value={form.smtp_password}
              onChange={(e) => set('smtp_password', e.target.value)}
              placeholder={passwordSet ? '••••••••  (dejar vacío para no cambiar)' : 'Ingresa la contraseña'}
              autoComplete="new-password"
            />
            {!passwordSet && (
              <p className="text-xs text-amber-600 mt-1">
                Sin contraseña, no se pueden enviar invitaciones.
                Para Gmail necesitas una <em>app password</em>.
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.smtp_use_tls}
              onChange={(e) => set('smtp_use_tls', e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
            />
            <span>
              <strong>Usar conexión segura (STARTTLS)</strong>
              <span className="text-slate-400 block text-xs">
                Recomendado. Se aplica en puertos como 587.
              </span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.smtp_reject_unauthorized}
              onChange={(e) => set('smtp_reject_unauthorized', e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
            />
            <span>
              <strong>Rechazar certificados no autorizados</strong>
              <span className="text-slate-400 block text-xs">
                Recomendado en producción. Desactivar solo para servidores internos con cert autofirmado.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button className="btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
          <button
            className="btn-secondary btn-sm"
            onClick={() => { setTestOpen(true); setTestMsg(''); setTestError('') }}
            disabled={!passwordSet && !form.smtp_password}
          >
            Probar envío
          </button>
        </div>
      </div>

      {testOpen && (
        <div className="card space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Probar envío</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enviaremos un email de prueba con la configuración actual. Guarda los cambios antes si acabás de editarlos.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[240px]">
              <label className="label">Destinatario</label>
              <input
                type="email"
                className="input"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="tu-email@empresa.com"
              />
            </div>
            <button className="btn-primary btn-sm" onClick={sendTest} disabled={testing || !testTo}>
              {testing ? 'Enviando…' : 'Enviar prueba'}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setTestOpen(false)} disabled={testing}>
              Cerrar
            </button>
          </div>
          {testError && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{testError}</div>}
          {testMsg && <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{testMsg}</div>}
        </div>
      )}
    </div>
  )
}
