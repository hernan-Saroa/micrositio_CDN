import api from './client'

export interface LoginCredentials {
    email: string
    password: string
}

export interface AuthUser {
    id: string
    nombre: string
    email: string
    rol: string
    avatar?: string
}

export const authApi = {
    login: (creds: LoginCredentials) =>
        api.post<{ token: string; user: AuthUser }>('/auth/login', creds).then((r) => r.data),

    logout: () =>
        api.post('/auth/logout').then((r) => r.data),

    me: () =>
        api.get<AuthUser>('/auth/me').then((r) => r.data),
}
