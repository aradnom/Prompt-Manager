import React, { createContext, useContext, useState } from 'react'

interface SettingsContextType {
  preferredLLMTarget: string | null
  setPreferredLLMTarget: (target: string) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [preferredLLMTarget, setPreferredLLMTargetState] = useState<string | null>(() => {
    return localStorage.getItem('preferred-llm-target')
  })

  const setPreferredLLMTarget = (target: string) => {
    setPreferredLLMTargetState(target)
    localStorage.setItem('preferred-llm-target', target)
  }

  return (
    <SettingsContext.Provider value={{ preferredLLMTarget, setPreferredLLMTarget }}>
      {children}
    </SettingsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
