import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '@/lib/api'
import { useSession } from '@/contexts/SessionContext'

interface UserStateContextType {
  stackCount: number
  blockCount: number
  isLoading: boolean
  refetch: () => void
}

const UserStateContext = createContext<UserStateContextType | undefined>(undefined)

export function UserStateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSession()
  const [stackCount, setStackCount] = useState(0)
  const [blockCount, setBlockCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const { data: stackData, refetch: refetchStacks } = api.stacks.list.useQuery(
    { countOnly: true },
    { enabled: isAuthenticated }
  )

  const { data: blockData, refetch: refetchBlocks } = api.blocks.list.useQuery(
    { countOnly: true },
    { enabled: isAuthenticated }
  )

  useEffect(() => {
    if (stackData && 'count' in stackData) {
      setStackCount(stackData.count)
    } else {
      setStackCount(0)
    }
  }, [stackData])

  useEffect(() => {
    if (blockData && 'count' in blockData) {
      setBlockCount(blockData.count)
    } else {
      setBlockCount(0)
    }
  }, [blockData])

  useEffect(() => {
    if (!isAuthenticated) {
      setStackCount(0)
      setBlockCount(0)
    }
  }, [isAuthenticated])

  const refetch = () => {
    refetchStacks()
    refetchBlocks()
  }

  return (
    <UserStateContext.Provider value={{ stackCount, blockCount, isLoading, refetch }}>
      {children}
    </UserStateContext.Provider>
  )
}

export function useUserState() {
  const context = useContext(UserStateContext)
  if (context === undefined) {
    throw new Error('useUserState must be used within a UserStateProvider')
  }
  return context
}
