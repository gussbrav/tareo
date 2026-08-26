/**
 * Config editable — Marca (logo, colores, empresa) y ajustes generales.
 * Todo persiste en public.system_settings (DB), sin env vars ni hardcode.
 * Logo se guarda como data URL base64 (misma convención que CRM Palma).
 */
import { useEffect, useRef, useState } from 'react'

import { configApi } from '../api/config'

const GROUPS = [
  {
    title: 'Marca — visual',
    keys: ['logo_url', 'brand_primary_color', 'brand_accent_color'],
  },
  {
    title: 'Empresa',
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
  logo_url: 'Logo',
  brand_primary_color: 'Color primario',
  brand_accent_color: 'Color de acento',
  company_name: 'Nombre de la empresa',
  company_taxid: 'RUC / Tax ID',
  company_address: 'Dirección',
  report_daily_hours: 'Horas de jornada legal',
  report_lunch_minutes: 'Minutos de refrigerio (default)',
  timezone: 'Zona horaria',
  app_environment_label: 'Etiqueta del ambiente',
}

const HINTS = {
  logo_url: 'Aparece en el header y en el login. Se recomienda PNG con fondo transparente, máx. 500 KB.',
  brand_primary_color: 'Botones, header, acentos principales.',
  brand_accent_color: 'Detalles, hover states, badges destacados.',
  company_name: 'Aparece en el header del Excel y en el login',
  company_taxid: 'Aparece en el Excel al lado de "RUC"',
  report_daily_hours: 'Se usa para calcular sobretiempo (default 8.0)',
  report_lunch_minutes: 'Si la actividad no trae hora refrigerio explícita',
  timezone: 'Ej. America/Lima, America/Argentina/Buenos_Aires',
  app_environment_label: 'Ej. producción, staging, demo',
}

const MAX_LOGO_BYTES = 500 * 1024 // 500 KB

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
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

  const setValue = (key, value) => setEdited({ ...edited, [key]: value })

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
        <h2 className="font-semibold text-slate-900 mb-1">Marca y configuración</h2>
        <p className="text-sm text-slate-500">
          El logo, los colores y los datos de la empresa se aplican al toque en todo el sistema —
          incluyendo el header, la pantalla de login y los reportes Excel.
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
              const busy = savingKey === key
              return (
                <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{LABELS[key] || key}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{HINTS[key] || ''}</div>
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    {key === 'logo_url' ? (
                      <LogoField
                        value={valueOf(key)}
                        onChange={(v) => setValue(key, v)}
                        onError={setError}
                      />
                    ) : key.endsWith('_color') ? (
                      <ColorField value={valueOf(key)} onChange={(v) => setValue(key, v)} />
                    ) : (
                      <input
                        className="input flex-1"
                        value={valueOf(key)}
                        onChange={(e) => setValue(key, e.target.value)}
                        placeholder="(vacío)"
                      />
                    )}
                    <button
                      className="btn-primary shrink-0"
                      onClick={() => save(key)}
                      disabled={!isDirty || busy}
                    >
                      {busy ? 'Guardando…' : 'Guardar'}
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

function LogoField({ value, onChange, onError }) {
  const inputRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      onError(`El logo pesa ${(file.size / 1024).toFixed(0)} KB. Máximo permitido: 500 KB.`)
      e.target.value = ''
      return
    }
    if (!file.type.startsWith('image/')) {
      onError('El archivo debe ser una imagen (PNG, JPG, SVG).')
      e.target.value = ''
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      onChange(dataUrl)
    } catch {
      onError('No se pudo procesar el archivo.')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt="Logo" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-[10px] text-slate-400">sin logo</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => inputRef.current?.click()}
          >
            {value ? 'Cambiar imagen' : 'Subir imagen'}
          </button>
          {value && (
            <button
              type="button"
              className="text-xs text-red-600 hover:underline text-left"
              onClick={() => onChange('')}
            >
              Quitar
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}

function ColorField({ value, onChange }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#1E40AF'
  return (
    <div className="flex-1 flex items-center gap-2">
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="w-12 h-10 rounded-md border border-slate-200 cursor-pointer shrink-0"
        title="Elegir color"
      />
      <input
        className="input flex-1 font-mono text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#1E40AF"
        maxLength={7}
      />
    </div>
  )
}
