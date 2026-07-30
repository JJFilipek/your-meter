import { apiRequest } from './client'

export type AuthUser = {
    id: string
    username: string
    email: string
}

export const getCurrentUser = () =>
    apiRequest<AuthUser>('/api/auth/me')

export const loginUser = (username: string, password: string) =>
    apiRequest<AuthUser>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    })

export const logoutUser = () =>
    apiRequest<void>('/api/auth/logout', { method: 'POST' })

export const updateUserProfile = (username: string, email: string) =>
    apiRequest<AuthUser>('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
    })

export const changeUserPassword = (currentPassword: string, newPassword: string) =>
    apiRequest<void>('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
    })
