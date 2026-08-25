import { api } from './client'

const resource = (path) => ({
  list: () => api.get(`/api/admin/${path}`).then((r) => r.data),
  create: (payload) => api.post(`/api/admin/${path}`, payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/api/admin/${path}/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/api/admin/${path}/${id}`),
})

export const adminApi = {
  trabajadores: resource('trabajadores'),
  usuarios: resource('usuarios'),
  areas: resource('areas'),
  especialidades: resource('especialidades'),
  centrosCosto: resource('centros-costo'),
  proyectos: resource('proyectos'),
  categorias: resource('categorias'),
}
