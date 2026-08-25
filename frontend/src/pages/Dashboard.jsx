import { useEffect, useState } from 'react'

import { api } from '../api/client'
import { useAuthStore } from '../store/auth'

export default function Dashboard() {
  const { user } = useAuthStore()
  const [health, setHealth] = useState(null)

  useEffect(() => {
    api.get('/api/health').then((r) => setHealth(r.data)).catch(() => setHealth({ status: 'error' }))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Bienvenido, {user?.first_name || user?.email}</h1>
        <p className="text-slate-500 text-sm">Panel principal — próximamente KPIs y accesos rápidos.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Estado del sistema</p>
          <p className={`mt-1 text-lg font-semibold ${health?.status === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
            {health?.status || 'cargando…'}
          </p>
          <p className="text-xs text-slate-400 mt-1">DB: {health?.db || '—'}</p>
        </div>

        <div className="card">
          <p className="text-xs uppercase text-slate-500">Tu rol</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 capitalize">{user?.role || '—'}</p>
        </div>

        <div className="card">
          <p className="text-xs uppercase text-slate-500">Entorno</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 capitalize">{health?.env || '—'}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-900">Próximos módulos</h2>
        <ul className="mt-2 text-sm text-slate-600 list-disc pl-5 space-y-1">
          <li>Control de Actividades (crear tareas para trabajadores)</li>
          <li>Tareo (lista del día, filtrar, finalizar)</li>
          <li>Mantenimiento (editar actividad)</li>
          <li>Reportes: horas por trabajador / semana / centro de costo</li>
          <li>Export a Excel</li>
          <li>Admin: catálogos y usuarios</li>
        </ul>
      </div>
    </div>
  )
}
