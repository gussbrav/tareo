import { api } from './client'

const resource = (path, { reorderable = false, scopable = false } = {}) => {
  const base = {
    // list acepta filtros opcionales (ej. proyecto_id) que van como query params
    list: (params = {}) => api.get(`/api/admin/${path}`, { params }).then((r) => r.data),
    create: (payload) => api.post(`/api/admin/${path}`, payload).then((r) => r.data),
    update: (id, payload) => api.patch(`/api/admin/${path}/${id}`, payload).then((r) => r.data),
    remove: (id) => api.delete(`/api/admin/${path}/${id}`),
  }
  if (reorderable) {
    base.reorder = (ids) => api.post(`/api/admin/${path}/reorder`, { ids })
  }
  return base
}

// helper para upload multipart
const uploadFile = (url, file) => {
  const fd = new FormData()
  fd.append('archivo', file)
  return api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
}

export const adminApi = {
  trabajadores: resource('trabajadores'),
  usuarios: resource('usuarios'),
  areas: resource('areas', { reorderable: true, scopable: true }),
  especialidades: resource('especialidades', { reorderable: true, scopable: true }),
  centrosCosto: resource('centros-costo', { reorderable: true, scopable: true }),
  proyectos: resource('proyectos', { reorderable: true }),
  categorias: resource('categorias', { reorderable: true }),

  // Importador Excel de jerarquía CECO por proyecto
  cecoImporter: {
    preview: (proyectoId, file) =>
      uploadFile(`/api/admin/proyectos/${proyectoId}/preview-cecos`, file),
    importar: (proyectoId, file) =>
      uploadFile(`/api/admin/proyectos/${proyectoId}/importar-cecos`, file),
  },
}
