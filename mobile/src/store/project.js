/**
 * useActiveProjectStore — "Proyecto activo" del usuario logueado.
 * Paridad con la web (frontend/src/store/project.js).
 *
 * El valor persiste en AsyncStorage y se aplica como pre-relleno / filtro en:
 *   - NuevaActividad (dropdown Contrato/Proyecto)
 *   - TareoScreen (filtro server-side vía ?proyecto_id)
 *   - AgendaScreen (filtro server-side vía ?proyecto_id)
 *   - HomeScreen dashboard (filtro server-side vía ?proyecto_id)
 *
 * `null` = "todos los proyectos accesibles" (default).
 * UUID = supervisor/trabajador con selección activa.
 *
 * Se limpia en logout (MasScreen.handleLogout) para no arrastrar
 * contexto entre usuarios distintos que compartan device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

const STORAGE_KEY = 'tareo.activeProject'

export const useActiveProjectStore = create((set) => ({
  activeProjectId: null,

  setActiveProjectId: async (id) => {
    const val = id || null
    set({ activeProjectId: val })
    try {
      if (val) await AsyncStorage.setItem(STORAGE_KEY, val)
      else await AsyncStorage.removeItem(STORAGE_KEY)
    } catch { /* silencioso */ }
  },

  clearActiveProject: async () => {
    set({ activeProjectId: null })
    try {
      await AsyncStorage.removeItem(STORAGE_KEY)
    } catch { /* silencioso */ }
  },
}))

export async function hydrateActiveProject() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) useActiveProjectStore.setState({ activeProjectId: raw })
  } catch { /* silencioso */ }
}
