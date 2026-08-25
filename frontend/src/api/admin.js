import { api } from './client'

export const adminApi = {
  trabajadores: {
    list: () => api.get('/api/admin/trabajadores').then((r) => r.data),
    create: (payload) => api.post('/api/admin/trabajadores', payload).then((r) => r.data),
    update: (id, payload) => api.patch(`/api/admin/trabajadores/${id}`, payload).then((r) => r.data),
    remove: (id) => api.delete(`/api/admin/trabajadores/${id}`),
  },
  usuarios: {
    list: () => api.get('/api/admin/usuarios').then((r) => r.data),
    create: (payload) => api.post('/api/admin/usuarios', payload).then((r) => r.data),
    update: (id, payload) => api.patch(`/api/admin/usuarios/${id}`, payload).then((r) => r.data),
    remove: (id) => api.delete(`/api/admin/usuarios/${id}`),
  },
}
