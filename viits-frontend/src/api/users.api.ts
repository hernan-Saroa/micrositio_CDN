import api from './client'

export interface User {
    id: string
    nombre: string
    email: string
    rol: 'admin' | 'supervisor' | 'operador' | 'auditor'
    estado: 'activo' | 'inactivo' | 'suspendido'
    createdAt: string
    lastLogin?: string
    avatar?: string
}

export const usersApi = {
    getAll: () => api.get<User[]>('/users').then(r => r.data),
    create: (data: Partial<User> & { password: string }) =>
        api.post<User>('/users', data).then(r => r.data),
    update: (id: string, data: Partial<User>) =>
        api.put<User>(`/users/${id}`, data).then(r => r.data),
    delete: (id: string) =>
        api.delete(`/users/${id}`).then(r => r.data),
    resetPassword: (id: string) =>
        api.post(`/users/${id}/reset-password`).then(r => r.data),
}
