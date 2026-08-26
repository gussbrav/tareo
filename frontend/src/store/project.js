import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * "Proyecto activo" del usuario logueado — para supervisores con 2+ proyectos.
 *
 * El valor persiste en localStorage y se aplica como pre-relleno en:
 *   - NuevaActividad (dropdown Contrato / Proyecto)
 *   - (futuro) filtros de Tareo, Agenda, Dashboard
 *
 * Convención: `null` = "todos" (default para admins que ven todo). Un UUID
 * específico = supervisor/trabajador con selección activa.
 *
 * Reset automático cuando el user hace logout — ver clearActiveProject().
 */
export const useActiveProjectStore = create(
  persist(
    (set) => ({
      activeProjectId: null,

      setActiveProjectId: (id) => set({ activeProjectId: id || null }),

      clearActiveProject: () => set({ activeProjectId: null }),
    }),
    { name: 'tareo.activeProject' },
  ),
)
