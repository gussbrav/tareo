import { api } from './client'

export const configApi = {
  publicSettings: () => api.get('/api/config/public').then((r) => r.data),
  general: () => api.get('/api/config/general').then((r) => r.data),
  settings: {
    list: () => api.get('/api/config/settings').then((r) => r.data),
    update: (key, value) =>
      api.patch(`/api/config/settings/${encodeURIComponent(key)}`, { value }).then((r) => r.data),
  },
  permissions: {
    matrix: () => api.get('/api/config/permissions').then((r) => r.data),
    toggle: (role, permission_key, allowed) =>
      api.post('/api/config/permissions', { role, permission_key, allowed }).then((r) => r.data),
  },
  myPermissions: () => api.get('/api/config/my-permissions').then((r) => r.data),
}
