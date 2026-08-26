import { api } from './client'

export const actividadesApi = {
  crearBulk: (payload) => api.post('/api/actividades', payload).then((r) => r.data),
  /**
   * Lista paginada de actividades del día.
   * Devuelve { items, total, page, size, pages }.
   *
   * `proyectoId` es filtro opcional (viene del "Proyecto activo" del topbar)
   * — se agrega al scope del user, no lo reemplaza.
   */
  listar: (fecha, { q = '', page = 1, size = 50, proyectoId = null } = {}) => {
    const params = { fecha, page, size }
    if (q && q.trim()) params.q = q.trim()
    if (proyectoId) params.proyecto_id = proyectoId
    return api.get('/api/actividades', { params }).then((r) => r.data)
  },
  listarMes: (mes, filtros = {}) =>
    api.get('/api/actividades/mes', { params: { mes, ...filtros } }).then((r) => r.data),
  detalle: (id) => api.get(`/api/actividades/${id}`).then((r) => r.data),
  editar: (id, payload) => api.patch(`/api/actividades/${id}`, payload).then((r) => r.data),
  eliminar: (id) => api.delete(`/api/actividades/${id}`).then((r) => r.data),
  finalizarBatch: (ids) =>
    api.post('/api/actividades/finalizar-batch', { ids }).then((r) => r.data),
  finalizarUna: (id) => api.post(`/api/actividades/${id}/finalizar`).then((r) => r.data),
}
