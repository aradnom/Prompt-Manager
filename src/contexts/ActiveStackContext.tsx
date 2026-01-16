import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { BlockStack, BlockWithRevisions } from '@/types/schema'
import { api } from '@/lib/api'
import { storage } from '@/lib/storage'

interface ActiveStackContextType {
  activeStack: BlockStack | null
  setActiveStack: (stack: BlockStack | null) => void
  activeStackBlocks: BlockWithRevisions[]
  setActiveStackBlocks: (blocks: BlockWithRevisions[]) => void
}

const ActiveStackContext = createContext<ActiveStackContextType | undefined>(undefined)

export function ActiveStackProvider({ children }: { children: ReactNode }) {
  const [activeStack, _setActiveStack] = useState<BlockStack | null>(null)
  const [activeStackBlocks, setActiveStackBlocks] = useState<BlockWithRevisions[]>([])
  const [storedId, setStoredId] = useState<number | null>(null)

  useEffect(() => {
    storage.getActiveStackId().then((id) => {
      if (id) setStoredId(id)
    })
  }, [])

  const { data: fetchedStack } = api.stacks.get.useQuery(
    { id: storedId! },
    { enabled: !!storedId && !activeStack }
  )

  useEffect(() => {
    if (fetchedStack) {
      _setActiveStack(fetchedStack)
    }
  }, [fetchedStack])

  const setActiveStack = (stack: BlockStack | null) => {
    _setActiveStack(stack)
    if (stack) {
      storage.setActiveStackId(stack.id)
      setStoredId(stack.id)
    } else {
      storage.clearActiveStackId()
      setStoredId(null)
      setActiveStackBlocks([])
    }
  }

  return (
    <ActiveStackContext.Provider value={{ activeStack, setActiveStack, activeStackBlocks, setActiveStackBlocks }}>
      {children}
    </ActiveStackContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveStack() {
  const context = useContext(ActiveStackContext)
  if (context === undefined) {
    throw new Error('useActiveStack must be used within an ActiveStackProvider')
  }
  return context
}
