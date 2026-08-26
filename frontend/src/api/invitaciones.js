import { api } from './client'

/**
 * Invitaciones — admin crea/lista/reenvía/cancela, público valida/acepta.
 */
export const invitacionesApi = {
  // Admin
  list: (onlyPending = true) =>
    api.get('/api/admin/invitations', { params: { only_pending: onlyPending } })
      .then((r) => r.data),
  create: (payload) => api.post('/api/admin/invitations', payload).then((r) => r.data),
  resend: (id) => api.post(`/api/admin/invitations/${id}/resend`).then((r) => r.data),
  cancel: (id) => api.delete(`/api/admin/invitations/${id}`),

  // Público (sin auth)
  validate: (token) => api.get(`/api/auth/invitations/${token}`).then((r) => r.data),
  accept: (token, password) =>
    api.post(`/api/auth/invitations/${token}/accept`, { password }).then((r) => r.data),
}
