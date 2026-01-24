import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { RasterIcon } from '@/components/RasterIcon'
import { CreateAccountOrLogin } from '@/components/CreateAccountOrLogin'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/contexts/SessionContext'

export default function Account() {
  const { isAuthenticated, isLoading: sessionLoading, checkSession, setAuthenticated } = useSession()
  const [accountData, setAccountData] = useState<Record<string, string> | null>(null)
  const [isLoadingAccount, setIsLoadingAccount] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated && !accountData) {
      fetchAccountData()
    }
  }, [isAuthenticated, accountData])

  const fetchAccountData = async () => {
    setIsLoadingAccount(true)
    try {
      const response = await fetch('http://localhost:3001/api/auth/account', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch account data')
      }

      const data = await response.json()
      setAccountData(data.accountData)
    } catch (err) {
      console.error('Error fetching account data:', err)
      setError('Failed to load account data')
    } finally {
      setIsLoadingAccount(false)
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        setAuthenticated(false)
        setAccountData(null)
        await checkSession()
      }
    } catch (err) {
      console.error('Error logging out:', err)
    }
  }

  const isLoading = sessionLoading || isLoadingAccount

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
                <CardTitle>Your Account ID</CardTitle>
                <CardDescription>
                  This is your unique Account ID. Jot it down in permanent ink somewhere because if you lose it, it cannot be found again.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="font-mono text-2xl font-bold tracking-wider p-4 bg-cyan-dark/20 rounded-lg border-2 border-cyan-dark">
                  {accountData.token}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleLogout} variant="outline">
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
