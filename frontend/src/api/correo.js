import { api } from './client'

/**
 * Config SMTP (Comunicación → Correo).
 * GET devuelve `smtp_password_set` (bool) — nunca el valor de la password.
 * PUT no sobreescribe el password si viene vacío (permite editar otros campos).
 */
export const correoApi = {
  get: () => api.get('/api/admin/correo').then((r) => r.data),
  update: (payload) => api.put('/api/admin/correo', payload).then((r) => r.data),
  test: (to) => api.post('/api/admin/correo/test', { to }),
}
