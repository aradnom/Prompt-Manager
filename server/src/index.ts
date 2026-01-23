import 'dotenv/config'
import express from 'express'
import cors from 'cors'
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
import { generateToken } from '@server/lib/token-generator'

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
      saveUninitialized: true,
      cookie: {
        secure: config.nodeEnv !== 'development',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      },
    })
  )

  // Token initialization middleware - generate token for new sessions
  app.use((req, _res, next) => {
    if (!req.session.token) {
      req.session.token = generateToken()
      console.debug(`Generated new token for session: ${req.session.token}`)
    }
    next()
  })

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

  // Token endpoint - returns current session token
  app.get('/api/auth/token', (req, res) => {
    if (!req.session.token) {
      return res.status(500).json({ error: 'No token in session' })
    }
    res.json({ token: req.session.token })
  })

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
