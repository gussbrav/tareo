import axios from 'axios'

import { useAuthStore } from '../store/auth'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Inyecta el access token si existe.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Manejo simple: 401 -> intentar refresh una vez; si falla, logout.
let refreshing = null

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (!error.response || error.response.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState()
    if (!refreshToken) {
      logout()
      return Promise.reject(error)
    }

    original._retry = true
    try {
      refreshing = refreshing || axios.post(`${baseURL}/api/auth/refresh`, { refresh_token: refreshToken })
      const { data } = await refreshing
      setTokens(data.access_token, data.refresh_token, data.user)
      original.headers.Authorization = `Bearer ${data.access_token}`
      return api(original)
    } catch (e) {
      logout()
      return Promise.reject(e)
    } finally {
      refreshing = null
    }
  },
)
