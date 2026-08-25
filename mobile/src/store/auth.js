import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

const STORAGE_KEY = 'tareo.auth'

export const useAuthStore = create((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,

  setTokens: async (accessToken, refreshToken, user) => {
    set({ accessToken, refreshToken, user })
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, refreshToken, user }))
    } catch {}
  },

  logout: async () => {
    set({ accessToken: null, refreshToken: null, user: null })
    try {
      await AsyncStorage.removeItem(STORAGE_KEY)
    } catch {}
  },
}))

export async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      useAuthStore.setState(s)
    }
  } catch {}
}
