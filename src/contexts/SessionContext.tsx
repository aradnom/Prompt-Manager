import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SessionContextType {
  isAuthenticated: boolean
  isLoading: boolean
  userId: number | null
  checkSession: () => Promise<void>
  setAuthenticated: (authenticated: boolean, userId?: number) => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<number | null>(null)

  const checkSession = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/auth/session', {
        credentials: 'include',
      })
      const data = await response.json()

      if (data.authenticated) {
        setIsAuthenticated(true)
        setUserId(data.userId)
      } else {
        setIsAuthenticated(false)
        setUserId(null)
      }
    } catch (err) {
      console.error('Error checking session:', err)
      setIsAuthenticated(false)
      setUserId(null)
    } finally {
      setIsLoading(false)
    }
  }

  const setAuthenticated = (authenticated: boolean, userIdValue?: number) => {
    setIsAuthenticated(authenticated)
    setUserId(userIdValue ?? null)
  }

  useEffect(() => {
    checkSession()
  }, [])

  return (
    <SessionContext.Provider value={{ isAuthenticated, isLoading, userId, checkSession, setAuthenticated }}>
      {children}
    </SessionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const context = useContext(SessionContext)
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
