/**
 * Info del sistema — versión, estado de servicios, cliente, modo.
 * Read-only. Copy amigable, sin exponer strings técnicos de infra.
 */
import { useEffect, useState } from 'react'

import { configApi } from '../api/config'

function StatusBadge({ up, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 ${
        up
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-red-50 text-red-700 border-red-200'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${up ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {label}
    </span>
  )
}

function formatBuildTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function AdminGeneral() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    configApi
      .general()
      .then(setData)
      .catch(() => setError('No se pudo cargar la información del sistema'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <p className="text-slate-500 text-sm">Cargando…</p>
  if (error) return <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Estado del sistema</h2>
            <p className="text-sm text-slate-500">Conexión a los servicios principales.</p>
          </div>
          <button onClick={load} className="btn-secondary text-xs">↻ Verificar</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-800">API Backend</div>
              <div className="text-xs text-slate-500 truncate">Servidor de aplicaciones</div>
            </div>
            <StatusBadge up={data.api_status === 'up'} label={data.api_status === 'up' ? 'Operativo' : 'Caído'} />
          </div>
          <div className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-800">Base de datos</div>
              <div className="text-xs text-slate-500 truncate">Almacén principal del sistema</div>
            </div>
            <StatusBadge up={data.db_status === 'up'} label={data.db_status === 'up' ? 'Operativa' : 'Caída'} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-3">Información del sistema</h2>
        <dl className="divide-y divide-slate-100">
          <Row label="Versión" value={data.version} />
          <Row label="Actualizado" value={formatBuildTime(data.build_time)} />
          <Row label="Cliente" value={data.company_name} />
          <Row label="Ambiente" value={data.environment} />
          <Row label="Desarrollado por" value={`${data.developed_by} — www.azoramind.com`} />
        </dl>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 text-right">{value}</dd>
    </div>
  )
}
