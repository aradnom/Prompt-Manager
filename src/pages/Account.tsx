import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { RasterIcon } from '@/components/RasterIcon'
import { CreateAccountOrLogin } from '@/components/CreateAccountOrLogin'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Account() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accountData, setAccountData] = useState<Record<string, string> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/session', {
        credentials: 'include',
      })
      const data = await response.json()

      if (data.authenticated) {
        setIsAuthenticated(true)
        await fetchAccountData()
      } else {
        setIsAuthenticated(false)
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Error checking session:', err)
      setIsAuthenticated(false)
      setIsLoading(false)
    }
  }

  const fetchAccountData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/account', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch account data')
      }

      const data = await response.json()
      setAccountData(data.accountData)
      setIsLoading(false)
    } catch (err) {
      console.error('Error fetching account data:', err)
      setError('Failed to load account data')
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        setIsAuthenticated(false)
        setAccountData(null)
        window.location.reload() // Refresh to show login screen
      }
    } catch (err) {
      console.error('Error logging out:', err)
    }
  }

  return (
    <main className="container mx-auto p-8 pt-20">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="user" size={36} />
          Account
        </h1>
        <p className="text-cyan-medium mb-8">
          <mark className="highlighted-text">Manage your account settings</mark>
        </p>
      </motion.div>

      <div className="mt-12">
        {isLoading ? (
          <p className="text-cyan-medium">Loading...</p>
        ) : isAuthenticated && accountData ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Access Token</CardTitle>
                <CardDescription>
                  This is your unique access token. Write it down and keep it safe.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="font-mono text-2xl font-bold tracking-wider p-4 bg-cyan-dark/20 rounded-lg border-2 border-cyan-dark">
                  {accountData.token}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleLogout} variant="destructive">
                Log Out
              </Button>
            </div>
          </div>
        ) : (
          <CreateAccountOrLogin />
        )}

        {error && (
          <p className="text-red-500 mt-4">{error}</p>
        )}
      </div>
    </main>
  )
}
