import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '@/api/auth.api'
import { authApi } from '@/api/auth.api'

interface AuthState {
    user: AuthUser | null
    token: string | null
    isLoading: boolean
    error: string | null
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isLoading: false,
            error: null,

            login: async (email, password) => {
                set({ isLoading: true, error: null })
                try {
                    const { token, user } = await authApi.login({ email, password })
                    localStorage.setItem('viits_token', token)
                    set({ user, token, isLoading: false })
                } catch (err: any) {
                    set({ error: err.response?.data?.message || 'Error de autenticación', isLoading: false })
                    throw err
                }
            },

            logout: async () => {
                try { await authApi.logout() } catch { /* ignore */ }
                localStorage.removeItem('viits_token')
                set({ user: null, token: null })
            },

            checkAuth: async () => {
                const token = localStorage.getItem('viits_token')
                if (!token) return
                try {
                    const user = await authApi.me()
                    set({ user, token })
                } catch {
                    localStorage.removeItem('viits_token')
                    set({ user: null, token: null })
                }
            },
        }),
        { name: 'viits-auth', partialize: (s) => ({ token: s.token, user: s.user }) }
    )
)
