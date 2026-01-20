import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ScrollContextType {
  scrollY: number
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined)

export function ScrollProvider({ children }: { children: ReactNode }) {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    // Initial value
    setScrollY(window.scrollY)

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <ScrollContext.Provider value={{ scrollY }}>
      {children}
    </ScrollContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScroll() {
  const context = useContext(ScrollContext)
  if (context === undefined) {
    throw new Error('useScroll must be used within a ScrollProvider')
  }
  return context
}
