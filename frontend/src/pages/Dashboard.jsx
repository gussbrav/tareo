import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { reportesApi } from '../api/reportes'
import { useAuthStore } from '../store/auth'
import { today } from '../lib/format'

const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const PALETTE = ['#1E40AF', '#3B65F5', '#6089FA', '#93B4FD', '#BFD3FE', '#F5C542', '#D9A518', '#B8860B']

export default function Dashboard() {
  const { user } = useAuthStore()
  const canExport = user?.role === 'admin' || user?.role === 'supervisor'
  const [desde, setDesde] = useState(daysAgo(30))
  const [hasta, setHasta] = useState(today())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    reportesApi
      .kpis(desde, hasta)
      .then(setData)
      .catch(() => setError('No se pudieron cargar los KPIs'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [desde, hasta])

  const handleExport = async () => {
    setExporting(true)
    try {
      await reportesApi.descargarExcel(desde, hasta)
    } catch {
      setError('No se pudo generar el Excel')
    } finally {
      setExporting(false)
    }
  }

  const kpis = data?.generales || {}
  const perTrabajador = data?.por_trabajador || []
  const perSemana = data?.por_semana || []
  const perCC = data?.por_centro_costo || []

  const totalHoras = useMemo(
    () => Math.round(((kpis.minutos_totales || 0) / 60) * 10) / 10,
    [kpis.minutos_totales],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm">
            KPIs entre {desde} y {hasta}
          </p>
        </div>
        {canExport && (
          <button className="btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Generando…' : '↓ Exportar Excel'}
          </button>
        )}
      </div>

      <div className="card grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Desde</label>
          <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Actividades" value={kpis.total_actividades ?? '—'} />
        <KpiCard label="Finalizadas" value={kpis.finalizadas ?? '—'} tone="emerald" />
        <KpiCard label="En proceso" value={kpis.en_proceso ?? '—'} tone="amber" />
        <KpiCard label="Horas totales" value={totalHoras ?? '—'} tone="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-3">Horas por trabajador</h2>
          <div className="h-72">
            {loading ? (
              <p className="text-slate-500 text-sm">Cargando…</p>
            ) : perTrabajador.length === 0 ? (
              <p className="text-slate-500 text-sm">Sin data en el rango</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perTrabajador} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="trabajador" type="category" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="horas" fill="#1E40AF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-3">Horas por semana</h2>
          <div className="h-72">
            {loading ? (
              <p className="text-slate-500 text-sm">Cargando…</p>
            ) : perSemana.length === 0 ? (
              <p className="text-slate-500 text-sm">Sin data en el rango</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perSemana}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 12 }} label={{ value: 'Semana', position: 'insideBottom', offset: -3 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="horas" fill="#3B65F5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-3">Horas por centro de costo</h2>
        {loading ? (
          <p className="text-slate-500 text-sm">Cargando…</p>
        ) : perCC.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin data en el rango</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={perCC}
                    dataKey="horas"
                    nameKey="centro_costo"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.centro_costo} (${entry.horas}h)`}
                  >
                    {perCC.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-y-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="text-slate-500 text-xs uppercase text-left">
                  <tr>
                    <th className="py-2">CC</th>
                    <th className="py-2">Actividades</th>
                    <th className="py-2 text-right">Horas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {perCC.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 text-slate-800">{r.centro_costo}</td>
                      <td className="py-2 text-slate-600">{r.actividades}</td>
                      <td className="py-2 text-right font-medium">{r.horas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, tone = 'slate' }) {
  const toneMap = {
    slate: 'text-slate-900',
    brand: 'text-brand-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
  }
  return (
    <div className="card">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${toneMap[tone]}`}>{value}</p>
    </div>
  )
}
