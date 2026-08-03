import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { apiFetch, getToken, setToken as persistToken } from './api'

export interface User {
  id: string
  email: string
  name: string
  companyId: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, companyName: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const storedToken = await getToken()
        if (storedToken) {
          setTokenState(storedToken)
          const storedUser = await (await import('./api')).storageGet('user')
          if (storedUser) setUser(JSON.parse(storedUser))
        }
      } catch {
        // ignore corrupted storage
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const { token: newToken, user: newUser } = data
    await persistToken(newToken)
    await (await import('./api')).storageSet('user', JSON.stringify(newUser))
    setTokenState(newToken)
    setUser(newUser)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string, companyName: string) => {
    const data = await apiFetch<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, companyName }),
    })
    const { token: newToken, user: newUser } = data
    await persistToken(newToken)
    await (await import('./api')).storageSet('user', JSON.stringify(newUser))
    setTokenState(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {})
    } catch {
      // ignore
    }
    await persistToken(null)
    await (await import('./api')).storageDelete('user')
    setTokenState(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!token && !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
