import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import { RedisStore } from 'connect-redis'
import { createClient } from 'redis'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { PostgresStorageAdapter } from '@server/adapters/postgres-adapter'
import { createContext } from '@server/trpc'
import { appRouter } from '@server/routers'
import { loadConfig } from '@server/config'
import { LLMService } from '@server/services/llm-service'
import { validateKey } from '@server/lib/api-key'
import { generateToken, hashToken, encryptAccountData, decryptAccountData, generateSessionKey, encryptDerivedKey, deriveEncryptionKey, decrypt, encrypt } from '@server/lib/auth'
import { withDerivedKey } from '@server/middleware/account-data'

// SSE connection manager
const sseClients = new Map<number, Set<express.Response>>()

export function notifyStackUpdate(userId: number, displayId: string, renderedContent: string) {
  const clients = sseClients.get(userId)
  if (clients) {
    const payload = JSON.stringify({ display_id: displayId, prompt: renderedContent })
    clients.forEach(client => {
      client.write(`data: ${payload}\n\n`)
    })
  }
}

// Middleware to authenticate ComfyUI requests
async function authenticateComfyUI(req: express.Request, res: express.Response, storage: PostgresStorageAdapter): Promise<number | null> {
  let token: string | undefined

  // Try to get token from Authorization header (Bearer token)
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }

  // If not in header, try query string (for SSE)
  if (!token && req.query.token) {
    token = req.query.token as string
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Provide token via Authorization header or query string.' })
    return null
  }

  // Validate the token
  if (!validateKey(token)) {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }

  // Get user ID by API key
  const userId = await storage.getUserIdByApiKey(token)
  if (!userId) {
    res.status(401).json({ error: 'Token not associated with any user' })
    return null
  }

  return userId
}

async function main() {
  const config = loadConfig()
  const app = express()

  // CORS configuration
  if (config.nodeEnv === 'development') {
    app.use(cors({
      origin: 'http://localhost:5173', // Frontend dev server
      credentials: true, // Allow cookies to be sent
    }))
  } else {
    app.use(cors())
  }
  app.use(express.json())
  app.use(cookieParser())

  // Initialize Redis client for sessions
  const redisClient = createClient({
    url: config.sessionDatabaseUrl,
  })
  redisClient.on('error', (err) => console.error('Redis Client Error', err))
  await redisClient.connect()
  console.debug('✓ Redis connection established')

  // Initialize session store
  const redisStore = new RedisStore({
    client: redisClient,
    prefix: 'sess:',
  })

  // Configure session middleware
  app.use(
    session({
      store: redisStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.nodeEnv !== 'development',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      },
    })
  )

  const storage = new PostgresStorageAdapter(config.databaseUrl)
  const llmService = new LLMService(config.llm)

  await storage.initialize()
  console.debug('✓ Database connection established')
  console.debug('✓ LLM service initialized')
  console.debug(`  Allowed targets: ${Array.from(config.llm.allowedTargets).join(', ')}`)

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: createContext(storage, llmService, config),
    })
  )

  // ComfyUI Integration Endpoints
  app.get('/api/integrations/comfyui/prompts/list', async (req, res) => {
    try {
      const userId = await authenticateComfyUI(req, res, storage)
      if (userId === null) return

      const stacks = await storage.listStacks(userId)
      const displayIds = stacks.map((stack) => stack.displayId)

      res.json({ prompts: displayIds })
    } catch (error) {
      console.error('Error fetching prompts for ComfyUI:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.get('/api/integrations/comfyui/prompts/get/raw', async (req, res) => {
    try {
      const userId = await authenticateComfyUI(req, res, storage)
      if (userId === null) return

      const displayId = req.query.display_id as string

      if (!displayId) {
        return res.status(400).json({ error: 'display_id query parameter is required' })
      }

      const prompt = await storage.getCompiledPrompt(displayId, userId)

      if (prompt === null) {
        return res.status(404).json({ error: 'Prompt not found' })
      }

      res.json({ prompt })
    } catch (error) {
      console.error('Error fetching raw prompt content for ComfyUI:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.get('/api/integrations/comfyui/prompts/get', async (req, res) => {
    try {
      const userId = await authenticateComfyUI(req, res, storage)
      if (userId === null) return

      const displayId = req.query.display_id as string

      if (!displayId) {
        return res.status(400).json({ error: 'display_id query parameter is required' })
      }

      const prompt = await storage.getRenderedPrompt(displayId, userId)

      if (prompt === null) {
        return res.status(404).json({ error: 'Prompt not found' })
      }

      res.json({ prompt })
    } catch (error) {
      console.error('Error fetching rendered prompt content for ComfyUI:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // SSE endpoint for ComfyUI integration
  app.get('/api/integrations/comfyui/events', async (req, res) => {
    const userId = await authenticateComfyUI(req, res, storage)
    if (userId === null) return

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Add client to the set for this user
    if (!sseClients.has(userId)) {
      sseClients.set(userId, new Set())
    }
    sseClients.get(userId)!.add(res)

    console.debug(`SSE client connected for user ${userId}`)

    // Send initial connection message
    res.write('data: {"connected": true}\n\n')

    // Handle client disconnect
    req.on('close', () => {
      const clients = sseClients.get(userId)
      if (clients) {
        clients.delete(res)
        if (clients.size === 0) {
          sseClients.delete(userId)
        }
      }
      console.debug(`SSE client disconnected for user ${userId}`)
    })
  })

  // ============================================================================
  // Authentication Endpoints
  // ============================================================================

  // Register new account - generates token, creates user, establishes session
  app.post('/api/auth/register', async (req, res) => {
    try {
      // Generate new token
      const token = generateToken()

      // Hash token for database lookup (HMAC-SHA256 - deterministic)
      const tokenHash = hashToken(token, config.tokenSecret)

      // Create account data with encrypted fields
      const accountData = await encryptAccountData(
        {
          token, // Store plaintext token encrypted so user can retrieve it later
        },
        token,
        config.encryptionSalt
      )

      // Create user in database
      const user = await storage.createUser({
        tokenHash,
        accountData,
      })

      // Generate session encryption key
      const sessionKey = generateSessionKey()

      // Derive the encryption key from the token
      const derivedKey = await deriveEncryptionKey(token, config.encryptionSalt)

      // Encrypt the derived key with the session key and store in session
      const encryptedDerivedKey = encryptDerivedKey(derivedKey, sessionKey)

      // Establish session with encrypted derived key
      req.session.userId = user.id
      req.session.encryptedDerivedKey = encryptedDerivedKey

      // Send session key in httpOnly cookie
      res.cookie('sessionKey', sessionKey, {
        httpOnly: true,
        secure: config.nodeEnv !== 'development',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      })

      console.debug(`Created new user account: ${user.id}`)

      // Return plaintext token to user (only time they'll see it unless they log in)
      res.json({ token })
    } catch (error) {
      console.error('Error creating account:', error)
      res.status(500).json({ error: 'Failed to create account' })
    }
  })

  // Login - authenticates token, establishes session, returns decrypted account data
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { token } = req.body

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Token is required' })
      }

      // Hash the provided token to look up the user (HMAC-SHA256 - deterministic)
      const tokenHash = hashToken(token, config.tokenSecret)

      // Find user by token hash
      const user = await storage.getUserByTokenHash(tokenHash)

      if (!user) {
        console.debug('Unable to find user for passed token')
        return res.status(401).json({ error: 'Invalid token' })
      }

      // Decrypt account data using the token
      if (!user.accountData) {
        console.debug('Unable to decrypt user account data');

        return res.status(500).json({ error: 'Account data not found' })
      }

      const decryptedData = await decryptAccountData(user.accountData, token, config.encryptionSalt)

      // Generate session encryption key
      const sessionKey = generateSessionKey()

      // Derive the encryption key from the token
      const derivedKey = await deriveEncryptionKey(token, config.encryptionSalt)

      // Encrypt the derived key with the session key and store in session
      const encryptedDerivedKey = encryptDerivedKey(derivedKey, sessionKey)

      // Establish session with encrypted derived key
      req.session.userId = user.id
      req.session.encryptedDerivedKey = encryptedDerivedKey

      // Send session key in httpOnly cookie
      res.cookie('sessionKey', sessionKey, {
        httpOnly: true,
        secure: config.nodeEnv !== 'development',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      })

      console.debug(`User logged in: ${user.id}`)

      // Return decrypted account data so user can view their token
      res.json({ accountData: decryptedData })
    } catch (error) {
      console.error('Error during login:', error)
      res.status(500).json({ error: 'Failed to log in' })
    }
  })

  // Logout - destroys session
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const userId = req.session.userId

      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err)
          return res.status(500).json({ error: 'Failed to log out' })
        }

        // Clear the session key cookie
        res.clearCookie('sessionKey')
        res.clearCookie('connect.sid')

        if (userId) {
          console.debug(`User logged out: ${userId}`)
        }

        res.json({ success: true })
      })
    } catch (error) {
      console.error('Error during logout:', error)
      res.status(500).json({ error: 'Failed to log out' })
    }
  })

  // Get current session status
  app.get('/api/auth/session', async (req, res) => {
    try {
      const userId = req.session.userId

      if (!userId) {
        return res.json({ authenticated: false })
      }

      res.json({ authenticated: true, userId })
    } catch (error) {
      console.error('Error checking session:', error)
      res.status(500).json({ error: 'Failed to check session' })
    }
  })

  // Get account data (requires authenticated session with sessionKey cookie)
  app.get('/api/auth/account', withDerivedKey, async (req, res) => {
    try {
      const userId = req.session.userId
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' })
      }

      // Get user from database
      const user = await storage.getUserById(userId)
      if (!user || !user.accountData) {
        return res.status(404).json({ error: 'User or account data not found' })
      }

      // Decrypt account data using the derived key from middleware
      const derivedKey = req.derivedKey!
      const decryptedData: Record<string, string> = {}

      for (const [field, encryptedValue] of Object.entries(user.accountData)) {
        // Skip apiKeys field - we'll handle it separately
        if (field === 'apiKeys') continue
        decryptedData[field] = decrypt(encryptedValue, derivedKey)
      }

      // Check which API keys are configured and return model info (without exposing the actual keys)
      const apiKeyInfo: Record<string, { configured: boolean; model?: string }> = {
        vertex: { configured: false },
        openai: { configured: false },
        anthropic: { configured: false },
      }

      if (user.accountData.apiKeys) {
        try {
          const decryptedApiKeys = decrypt(user.accountData.apiKeys as string, derivedKey)
          const apiKeys = JSON.parse(decryptedApiKeys) as Record<string, any>

          // Set configuration status and model for each provider
          for (const provider of Object.keys(apiKeyInfo)) {
            const providerData = apiKeys[provider]
            if (providerData && typeof providerData === 'object' && providerData.key) {
              apiKeyInfo[provider] = {
                configured: true,
                model: providerData.model,
              }
            }
          }
        } catch (error) {
          console.error('Error decrypting API keys for flags:', error)
          // Leave all as unconfigured if decryption fails
        }
      }

      res.json({ accountData: decryptedData, apiKeys: apiKeyInfo })
    } catch (error) {
      console.error('Error fetching account data:', error)
      res.status(500).json({ error: 'Failed to fetch account data' })
    }
  })

  // Save API keys (encrypted in account_data.apiKeys)
  app.post('/api/auth/api-keys', withDerivedKey, async (req, res) => {
    try {
      const userId = req.session.userId
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' })
      }

      const { provider, apiKey, model } = req.body
      if (!provider) {
        return res.status(400).json({ error: 'Provider is required' })
      }

      // Valid providers
      const validProviders = ['vertex', 'openai', 'anthropic']
      if (!validProviders.includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider' })
      }

      // Get user from database
      const user = await storage.getUserById(userId)
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Get current account data (already encrypted)
      const currentAccountData = user.accountData || {}

      // Decrypt apiKeys field if it exists
      const derivedKey = req.derivedKey!
      let apiKeys: Record<string, any> = {}

      if (currentAccountData.apiKeys) {
        try {
          const decryptedApiKeys = decrypt(currentAccountData.apiKeys as string, derivedKey)
          apiKeys = JSON.parse(decryptedApiKeys)
        } catch (error) {
          console.error('Error decrypting existing API keys:', error)
          // If decryption fails, start fresh
          apiKeys = {}
        }
      }

      // Check if we're updating an existing provider or creating new
      const existingProvider = apiKeys[provider]

      // If apiKey is '__PRESERVE__', keep the existing key (for model-only updates)
      if (apiKey === '__PRESERVE__' && existingProvider && existingProvider.key) {
        // Just update the model, preserve the key
        apiKeys[provider] = {
          key: existingProvider.key,
          ...(model && { model }),
        }
      } else if (apiKey) {
        // Update or set new API key
        apiKeys[provider] = {
          key: apiKey,
          ...(model && { model }),
        }
      } else {
        return res.status(400).json({ error: 'apiKey is required for new configurations' })
      }

      // Encrypt the updated apiKeys object
      const encryptedApiKeys = encrypt(JSON.stringify(apiKeys), derivedKey)

      // Update account data with encrypted apiKeys
      const updatedAccountData = {
        ...currentAccountData,
        apiKeys: encryptedApiKeys,
      }

      // Update user in database
      await storage.updateUserAccountData(userId, updatedAccountData)

      res.json({ success: true })
    } catch (error) {
      console.error('Error saving API key:', error)
      res.status(500).json({ error: 'Failed to save API key' })
    }
  })

  // ============================================================================
  // Health Check
  // ============================================================================

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.listen(config.port, () => {
    console.debug(`✓ Server listening on http://localhost:${config.port}`)
    console.debug(`✓ tRPC endpoint: http://localhost:${config.port}/trpc`)
  })
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
