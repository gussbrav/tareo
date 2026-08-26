import { api } from './client'

export const reportesApi = {
  /**
   * `proyectoId` (opcional) — filtro del "Proyecto activo" del topbar mobile.
   * Se aplica server-side. null = todos los proyectos accesibles del user.
   */
  dashboard: (desde, hasta, proyectoId = null) => {
    const params = { desde, hasta }
    if (proyectoId) params.proyecto_id = proyectoId
    return api.get('/api/reportes/dashboard', { params }).then((r) => r.data)
  },
}
