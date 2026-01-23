import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { RasterIcon } from '@/components/RasterIcon'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function Account() {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('http://localhost:3001/api/auth/token', {
      credentials: 'include', // Important: send cookies with request
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch token')
        }
        return res.json()
      })
      .then(data => {
        setToken(data.token)
        setIsLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setIsLoading(false)
      })
  }, [])

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
        <p className="text-cyan-medium">
          <mark className="highlighted-text">Manage your account settings</mark>
        </p>
      </motion.div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Your Access Token</CardTitle>
            <CardDescription>
              This is your unique access token. Write it down and keep it safe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-cyan-medium">Loading token...</p>
            ) : error ? (
              <p className="text-red-500">Error: {error}</p>
            ) : (
              <div className="font-mono text-2xl font-bold tracking-wider p-4 bg-cyan-dark/20 rounded-lg border-2 border-cyan-dark">
                {token}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
