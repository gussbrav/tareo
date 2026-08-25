import { api } from './client'

export const actividadesApi = {
  listar: (fecha) => api.get('/api/actividades', { params: { fecha } }).then((r) => r.data),
  crearBulk: (payload) => api.post('/api/actividades', payload).then((r) => r.data),
  finalizarUna: (id) => api.post(`/api/actividades/${id}/finalizar`).then((r) => r.data),
  finalizarBatch: (ids) => api.post('/api/actividades/finalizar-batch', { ids }).then((r) => r.data),
}

export const catalogosApi = {
  areas: () => api.get('/api/catalogos/areas').then((r) => r.data),
  especialidades: (areaId) =>
    api.get('/api/catalogos/especialidades', { params: { area_id: areaId } }).then((r) => r.data),
  centrosCosto: (especialidadId) =>
    api.get('/api/catalogos/centros-costo', { params: { especialidad_id: especialidadId } }).then((r) => r.data),
  proyectos: () => api.get('/api/catalogos/proyectos').then((r) => r.data),
  trabajadoresDisponibles: (fecha) =>
    api.get('/api/catalogos/trabajadores', { params: { fecha } }).then((r) => r.data),
}
