/**
 * ActiveProjectPicker — selector de "proyecto activo" en el topbar.
 *
 * Patrón GitHub org switcher / Slack workspace: cuando el user tiene
 * acceso a 2+ proyectos, aparece un chip que le permite elegir en cuál
 * está "trabajando ahora". La selección se persiste (Zustand + localStorage).
 *
 * Consumers:
 *   - NuevaActividad: prefill del dropdown de proyecto
 *   - (futuro) Tareo/Agenda/Dashboard: filtro adicional
 *
 * Visibilidad: solo si el user tiene >= 2 proyectos accesibles. Con 0 o 1
 * proyecto el picker no aporta y solo agrega ruido visual → oculto.
 */
import { useEffect, useState } from 'react'

import { catalogosApi } from '../api/catalogos'
import { useActiveProjectStore } from '../store/project'
import { Icon } from './admin/Icons.jsx'
import SearchableSelect from './admin/SearchableSelect.jsx'

export default function ActiveProjectPicker() {
  const [proyectos, setProyectos] = useState([])
  const { activeProjectId, setActiveProjectId } = useActiveProjectStore()

  useEffect(() => {
    catalogosApi.proyectos()
      .then(setProyectos)
      .catch(() => setProyectos([]))
  }, [])

  // Si la selección actual quedó desactualizada (el user perdió acceso),
  // limpiar. Evita mostrar un nombre viejo o quedar "atascado" en un proyecto
  // que el admin le sacó.
  useEffect(() => {
    if (activeProjectId && proyectos.length > 0) {
      const stillAccessible = proyectos.some((p) => p.id === activeProjectId)
      if (!stillAccessible) setActiveProjectId(null)
    }
  }, [proyectos, activeProjectId, setActiveProjectId])

  // Oculto si solo hay 0 o 1 proyecto — no aporta al UX.
  if (proyectos.length < 2) return null

  // Options con item "Todos" al inicio (útil para admins con muchos proyectos).
  const options = [
    { id: '', __label: 'Todos los proyectos' },
    ...proyectos.map((p) => ({
      id: p.id,
      __label: p.descontratoproyecto || p.nbrproyecto || `Código ${p.codproyecto}`,
    })),
  ]

  return (
    <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200">
      <Icon.Folder className="w-3.5 h-3.5 text-slate-400" />
      <div className="w-56">
        <SearchableSelect
          value={activeProjectId || ''}
          onChange={(v) => setActiveProjectId(v)}
          options={options}
          getLabel={(o) => o.__label}
          placeholder="Todos los proyectos"
        />
      </div>
    </div>
  )
}
