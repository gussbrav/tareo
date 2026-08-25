import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import Constants from 'expo-constants'

import { useAuthStore } from '../store/auth'

const baseURL = Constants.expoConfig?.extra?.apiBaseUrl || 'https://tareo.azoramind.com'

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

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
      await logout()
      return Promise.reject(error)
    }
    original._retry = true
    try {
      refreshing = refreshing || axios.post(`${baseURL}/api/auth/refresh`, { refresh_token: refreshToken })
      const { data } = await refreshing
      await setTokens(data.access_token, data.refresh_token, data.user)
      original.headers.Authorization = `Bearer ${data.access_token}`
      return api(original)
    } catch (e) {
      await logout()
      return Promise.reject(e)
    } finally {
      refreshing = null
    }
  },
)
