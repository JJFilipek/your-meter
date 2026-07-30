import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  changeUserPassword,
  getCurrentUser,
  loginUser,
  logoutUser,
  updateUserProfile,
  type AuthUser,
} from './api/auth'

export type AuthContextType = {
  isAuthenticated: boolean
  isLoading: boolean
  user: AuthUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUser: (updates: Pick<AuthUser, 'username' | 'email'>) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    getCurrentUser()
      .then((currentUser) => {
        if (isMounted) setUser(currentUser)
      })
      .catch(() => {
        if (isMounted) setUser(null)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    const handleUnauthorized = () => setUser(null)
    window.addEventListener('auth:unauthorized', handleUnauthorized)

    return () => {
      isMounted = false
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
    }
  }, [])

  const login = async (username: string, password: string) => {
    setUser(await loginUser(username, password))
  }

  const logout = async () => {
    try {
      await logoutUser()
    } finally {
      setUser(null)
    }
  }

  const updateUser = async (updates: Pick<AuthUser, 'username' | 'email'>) => {
    setUser(await updateUserProfile(updates.username, updates.email))
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await changeUserPassword(currentPassword, newPassword)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated: user !== null,
      isLoading,
      user,
      login,
      logout,
      updateUser,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
