import { api } from './client'

export const actividadesApi = {
  // Backend ahora devuelve { items, total, page, size, pages }. En mobile no
  // paginamos aún (UI Gmail-style pendiente), así que pedimos el máximo (200)
  // y desempaquetamos .items para no romper los consumidores existentes.
  listar: (fecha) =>
    api.get('/api/actividades', { params: { fecha, size: 200 } })
      .then((r) => r.data?.items || []),
  listarMes: (mes, filtros = {}) =>
    api.get('/api/actividades/mes', { params: { mes, ...filtros } }).then((r) => r.data),
  detalle: (id) => api.get(`/api/actividades/${id}`).then((r) => r.data),
  crearBulk: (payload) => api.post('/api/actividades', payload).then((r) => r.data),
  editar: (id, payload) => api.patch(`/api/actividades/${id}`, payload).then((r) => r.data),
  eliminar: (id) => api.delete(`/api/actividades/${id}`),
  finalizarUna: (id) => api.post(`/api/actividades/${id}/finalizar`).then((r) => r.data),
  finalizarBatch: (ids) => api.post('/api/actividades/finalizar-batch', { ids }).then((r) => r.data),
}

export const catalogosApi = {
  areas: (proyectoId) =>
    api
      .get('/api/catalogos/areas', {
        params: proyectoId ? { proyecto_id: proyectoId } : {},
      })
      .then((r) => r.data),
  especialidades: (areaId) =>
    api.get('/api/catalogos/especialidades', { params: { area_id: areaId } }).then((r) => r.data),
  centrosCosto: (especialidadId) =>
    api.get('/api/catalogos/centros-costo', { params: { especialidad_id: especialidadId } }).then((r) => r.data),
  proyectos: () => api.get('/api/catalogos/proyectos').then((r) => r.data),
  trabajadoresDisponibles: (fecha) =>
    api.get('/api/catalogos/trabajadores', { params: { fecha } }).then((r) => r.data),
}
