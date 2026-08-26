import { api } from './client'

const resource = (path, { reorderable = false } = {}) => {
  const base = {
    list: () => api.get(`/api/admin/${path}`).then((r) => r.data),
    create: (payload) => api.post(`/api/admin/${path}`, payload).then((r) => r.data),
    update: (id, payload) => api.patch(`/api/admin/${path}/${id}`, payload).then((r) => r.data),
    remove: (id) => api.delete(`/api/admin/${path}/${id}`),
  }
  if (reorderable) {
    base.reorder = (ids) => api.post(`/api/admin/${path}/reorder`, { ids })
  }
  return base
}

export const adminApi = {
  trabajadores: resource('trabajadores'),
  usuarios: resource('usuarios'),
  areas: resource('areas', { reorderable: true }),
  especialidades: resource('especialidades', { reorderable: true }),
  centrosCosto: resource('centros-costo', { reorderable: true }),
  proyectos: resource('proyectos', { reorderable: true }),
  categorias: resource('categorias', { reorderable: true }),
}
