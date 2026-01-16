import { createContext, useContext, ReactNode } from 'react'
import type { Type } from '@/types/schema'
import { api } from '@/lib/api'

interface TypesContextType {
  types: Type[]
  isLoading: boolean
  refetch: () => void
}

const TypesContext = createContext<TypesContextType | undefined>(undefined)

export function TypesProvider({ children }: { children: ReactNode }) {
  const { data: types = [], isLoading, refetch } = api.types.list.useQuery()

  return (
    <TypesContext.Provider value={{ types, isLoading, refetch }}>
      {children}
    </TypesContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTypes() {
  const context = useContext(TypesContext)
  if (context === undefined) {
    throw new Error('useTypes must be used within a TypesProvider')
  }
  return context
}
