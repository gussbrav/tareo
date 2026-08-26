import { api } from './client'

export const configApi = {
  publicSettings: () => api.get('/api/config/public').then((r) => r.data),
}
