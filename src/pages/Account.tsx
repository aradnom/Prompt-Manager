import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { RasterIcon } from '@/components/RasterIcon'
import { CreateAccountOrLogin } from '@/components/CreateAccountOrLogin'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/contexts/SessionContext'
import { PREDEFINED_MODELS } from '@/lib/llm-model-names'

export default function Account() {
  const { isAuthenticated, isLoading: sessionLoading, checkSession, setAuthenticated } = useSession()
  const [accountData, setAccountData] = useState<Record<string, string> | null>(null)
  const [isLoadingAccount, setIsLoadingAccount] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKeyInfo, setApiKeyInfo] = useState<Record<string, { configured: boolean; model?: string }>>({})
  const [isSavingApiKey, setIsSavingApiKey] = useState(false)
  const [vertexApiKey, setVertexApiKey] = useState('')
  const [vertexModel, setVertexModel] = useState(Object.keys(PREDEFINED_MODELS.vertex)[0])
  const [customModel, setCustomModel] = useState('')

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
      setApiKeyInfo(data.apiKeys || {})

      // Pre-populate the model dropdown if a model is configured
      if (data.apiKeys?.vertex?.model) {
        const savedModel = data.apiKeys.vertex.model
        // Check if it's one of our predefined models
        if (savedModel in PREDEFINED_MODELS.vertex) {
          setVertexModel(savedModel)
        } else {
          // It's a custom model
          setVertexModel('custom')
          setCustomModel(savedModel)
        }
      }
    } catch (err) {
      console.error('Error fetching account data:', err)
      setError('Failed to load account data')
    } finally {
      setIsLoadingAccount(false)
    }
  }

  const handleSaveApiKey = async (provider: string, apiKey: string, model?: string) => {
    setIsSavingApiKey(true)
    try {
      const response = await fetch('http://localhost:3001/api/auth/api-keys', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, apiKey, model }),
      })

      if (!response.ok) {
        throw new Error('Failed to save API key')
      }

      // Refresh account data to get updated flags
      await fetchAccountData()
      // Clear the input fields after successful save
      setVertexApiKey('')
      setCustomModel('')
    } catch (err) {
      console.error('Error saving API key:', err)
      setError('Failed to save API key')
    } finally {
      setIsSavingApiKey(false)
    }
  }

  const handleSaveModel = async (provider: string, model: string) => {
    setIsSavingApiKey(true)
    try {
      // We need to send a placeholder key since the backend requires it
      // The backend will preserve the existing key
      const response = await fetch('http://localhost:3001/api/auth/api-keys', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, apiKey: '__PRESERVE__', model }),
      })

      if (!response.ok) {
        throw new Error('Failed to save model')
      }

      // Refresh account data
      await fetchAccountData()
      setCustomModel('')
    } catch (err) {
      console.error('Error saving model:', err)
      setError('Failed to save model')
    } finally {
      setIsSavingApiKey(false)
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

            <Card>
              <CardHeader>
                <CardTitle>LLM Settings</CardTitle>
                <CardDescription>
                  Configure API keys for LLM-powered features. Your keys are encrypted and never stored in plaintext.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Google Vertex AI API Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Enter your Vertex AI API key"
                        className="flex-1 px-3 py-2 rounded-md border border-cyan-medium bg-background"
                        value={vertexApiKey}
                        onChange={(e) => setVertexApiKey(e.target.value)}
                        disabled={isSavingApiKey}
                      />
                      <Button
                        onClick={() => {
                          const modelToSave = vertexModel === 'custom' ? customModel : vertexModel
                          handleSaveApiKey('vertex', vertexApiKey, modelToSave)
                        }}
                        disabled={isSavingApiKey || !vertexApiKey.trim()}
                      >
                        {isSavingApiKey ? 'Saving...' : apiKeyInfo.vertex?.configured ? 'Update' : 'Save'}
                      </Button>
                    </div>
                    {apiKeyInfo.vertex?.configured && (
                      <p className="text-sm text-cyan-medium mt-1">
                        ✓ API key configured
                      </p>
                    )}
                  </div>

                  {apiKeyInfo.vertex?.configured && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Model
                      </label>
                      <select
                        className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background mb-2"
                        value={vertexModel}
                        onChange={(e) => {
                          setVertexModel(e.target.value)
                          if (e.target.value !== 'custom') {
                            setCustomModel('')
                          }
                        }}
                        disabled={isSavingApiKey}
                      >
                        {Object.entries(PREDEFINED_MODELS.vertex).map(([modelId, displayName]) => (
                          <option key={modelId} value={modelId}>
                            {displayName}
                          </option>
                        ))}
                        <option value="custom">Custom Model</option>
                      </select>

                      {vertexModel === 'custom' && (
                        <input
                          type="text"
                          placeholder="Enter custom model ID (e.g., gemini-pro)"
                          className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background mb-2"
                          value={customModel}
                          onChange={(e) => setCustomModel(e.target.value)}
                          disabled={isSavingApiKey}
                        />
                      )}

                      <Button
                        onClick={() => {
                          const modelToSave = vertexModel === 'custom' ? customModel : vertexModel
                          handleSaveModel('vertex', modelToSave)
                        }}
                        disabled={isSavingApiKey || (vertexModel === 'custom' && !customModel.trim())}
                        className="flex ml-auto"
                      >
                        {isSavingApiKey ? 'Saving...' : 'Save Model'}
                      </Button>
                    </div>
                  )}
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
