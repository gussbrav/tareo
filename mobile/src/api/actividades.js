import { api } from './client'

export const actividadesApi = {
  // Backend devuelve { items, total, page, size, pages }. En mobile no
  // paginamos aún; pedimos el máximo (200) y desempaquetamos .items.
  //
  // `proyectoId` (opcional) viene del "Proyecto activo" del store.
  // Se agrega al scope del user, no lo reemplaza.
  listar: (fecha, { proyectoId = null } = {}) => {
    const params = { fecha, size: 200 }
    if (proyectoId) params.proyecto_id = proyectoId
    return api.get('/api/actividades', { params }).then((r) => r.data?.items || [])
  },
  listarMes: (mes, { proyectoId = null, ...filtros } = {}) => {
    const params = { mes, ...filtros }
    if (proyectoId) params.proyecto_id = proyectoId
    return api.get('/api/actividades/mes', { params }).then((r) => r.data)
  },
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
