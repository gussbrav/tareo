import { api } from './client'

/**
 * Endpoints self-service del usuario logueado.
 * Login/logout/refresh siguen viviendo inline (Login.jsx, UserMenu.jsx, client.js)
 * porque manejan la sesión Zustand — no se benefician de este helper.
 */
export const authApi = {
  me: () => api.get('/api/auth/me').then((r) => r.data),

  updateMe: (payload) => api.patch('/api/auth/me', payload).then((r) => r.data),

  /** Cambia la contraseña del user logueado. 204 si ok. */
  changePassword: (currentPassword, newPassword) =>
    api.post('/api/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
}
