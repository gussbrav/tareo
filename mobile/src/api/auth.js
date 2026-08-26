import { api } from './client'

/**
 * Endpoints self-service del usuario logueado.
 * Paridad con frontend/src/api/auth.js.
 * Login/logout/refresh siguen viviendo inline (LoginScreen, MasScreen, client)
 * porque manejan sesión Zustand.
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
