import { useState } from 'react'

import AdminTrabajadores from '../components/AdminTrabajadores.jsx'
import AdminUsuarios from '../components/AdminUsuarios.jsx'

const TABS = [
  { id: 'trabajadores', label: 'Trabajadores' },
  { id: 'usuarios', label: 'Usuarios' },
]

export default function Admin() {
  const [tab, setTab] = useState('trabajadores')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Administración</h1>
        <p className="text-slate-500 text-sm">Gestión de trabajadores, usuarios y catálogos.</p>
      </div>

      <div className="border-b border-slate-200 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'trabajadores' && <AdminTrabajadores />}
      {tab === 'usuarios' && <AdminUsuarios />}
    </div>
  )
}
