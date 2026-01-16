import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc, trpcClient } from './lib/trpc'
import { SettingsProvider } from './contexts/SettingsContext'
import App from './App.tsx'

export default function Root() {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
