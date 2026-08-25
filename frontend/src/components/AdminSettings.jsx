/**
 * Config editable — Marca y ajustes generales del sistema.
 * Todo persiste en public.system_settings (DB), sin env vars ni hardcode.
 */
import { useEffect, useState } from 'react'

import { configApi } from '../api/config'

const GROUPS = [
  {
    title: 'Marca / Empresa',
    keys: ['company_name', 'company_taxid', 'company_address'],
  },
  {
    title: 'Cálculo de horas',
    keys: ['report_daily_hours', 'report_lunch_minutes', 'timezone'],
  },
  {
    title: 'Ambiente',
    keys: ['app_environment_label'],
  },
]

const LABELS = {
  company_name: 'Nombre de la empresa',
  company_taxid: 'RUC / Tax ID',
  company_address: 'Dirección',
  report_daily_hours: 'Horas de jornada legal',
  report_lunch_minutes: 'Minutos de refrigerio (default)',
  timezone: 'Zona horaria',
  app_environment_label: 'Etiqueta del ambiente',
}

const HINTS = {
  company_name: 'Aparece en el header del Excel y en el login',
  company_taxid: 'Aparece en el Excel al lado de "RUC"',
  report_daily_hours: 'Se usa para calcular sobretiempo (default 8.0)',
  report_lunch_minutes: 'Si la actividad no trae hora refrigerio explícita',
  timezone: 'Ej. America/Lima, America/Argentina/Buenos_Aires',
  app_environment_label: 'Ej. producción, staging, demo',
}

export default function AdminSettings() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [edited, setEdited] = useState({})
  const [savingKey, setSavingKey] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    configApi.settings
      .list()
      .then(setItems)
      .catch(() => setError('No se pudo cargar la configuración'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const valueOf = (key) => {
    if (key in edited) return edited[key]
    return items.find((i) => i.key === key)?.value ?? ''
  }

  const save = async (key) => {
    setError('')
    setMsg('')
    setSavingKey(key)
    try {
      await configApi.settings.update(key, edited[key] ?? '')
      const next = { ...edited }
      delete next[key]
      setEdited(next)
      setMsg(`"${LABELS[key] || key}" guardado`)
      setTimeout(() => setMsg(''), 2000)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) return <p className="text-slate-500 text-sm">Cargando…</p>

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-1">Configuración de sistema</h2>
        <p className="text-sm text-slate-500">
          Estos valores se guardan en la base de datos y se aplican al toque. Reemplazan a las
          variables de entorno (que quedan solo como fallback si la DB no tiene el registro).
        </p>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
      {msg && <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{msg}</div>}

      {GROUPS.map((g) => (
        <div key={g.title} className="card">
          <h3 className="text-sm font-semibold text-brand-700 uppercase tracking-wide mb-4">
            {g.title}
          </h3>
          <div className="space-y-4">
            {g.keys.map((key) => {
              const isDirty = key in edited
              return (
                <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{LABELS[key] || key}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{HINTS[key] || ''}</div>
                    <code className="text-[10px] text-slate-400">{key}</code>
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <input
                      className="input flex-1"
                      value={valueOf(key)}
                      onChange={(e) => setEdited({ ...edited, [key]: e.target.value })}
                      placeholder="(vacío)"
                    />
                    <button
                      className="btn-primary shrink-0"
                      onClick={() => save(key)}
                      disabled={!isDirty || savingKey === key}
                    >
                      {savingKey === key ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
