import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Store de auth. Persistido en localStorage (key `tareo.auth`).
 * accessToken se mantiene en memoria + storage para UX simple.
 * En un endurecimiento futuro se puede mover refreshToken a HttpOnly cookie.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setTokens: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),

      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'tareo.auth' },
  ),
)
