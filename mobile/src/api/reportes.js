import { api } from './client'

export const reportesApi = {
  dashboard: (desde, hasta) =>
    api.get('/api/reportes/dashboard', { params: { desde, hasta } }).then((r) => r.data),
}
