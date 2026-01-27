// Define LLM targets as const array - single source of truth
export const LLM_TARGETS = ['lm-studio', 'openai', 'anthropic', 'vertex', 'grok'] as const
export type LLMTarget = typeof LLM_TARGETS[number]

export interface LLMConfig {
  allowedTargets: Set<string>
  lmStudioUrl: string
  maxTokens: number
  vertex: {
    projectId: string
    location: string
    model: string
    serviceAccountJson?: string
    apiEndpoint?: string
    apiKey?: string
  }
  openai: {
    apiKey?: string
    model: string
  }
  anthropic: {
    apiKey?: string
    model: string
  }
  grok: {
    apiKey?: string
    model: string
  }
}

export interface ServerConfig {
  port: number
  nodeEnv: string
  databaseUrl: string
  sessionDatabaseUrl: string
  sessionSecret: string
  encryptionSalt: string
  tokenSecret: string
  llm: LLMConfig
}

function parseAllowedTargets(envValue: string | undefined): Set<string> {
  if (!envValue) return new Set(LLM_TARGETS)
  return new Set(envValue.split(',').map(t => t.trim()))
}

export function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl:
      process.env.DATABASE_URL ||
      'postgresql://promptuser:promptpass@localhost:5432/prompt_manager',
    sessionDatabaseUrl:
      process.env.SESSION_DATABASE_URL ||
      'redis://localhost:6379/0',
    sessionSecret:
      process.env.SESSION_SECRET ||
      'change-this-to-a-random-secret-in-production',
    encryptionSalt:
      process.env.ENCRYPTION_SALT ||
      'change-this-to-a-random-32-char-string',
    tokenSecret:
      process.env.TOKEN_SECRET ||
      'change-this-to-a-random-secret-for-token-hashing',
    llm: {
      allowedTargets: parseAllowedTargets(process.env.LLM_ALLOWED_TARGETS),
      lmStudioUrl: process.env.LM_STUDIO_URL || 'http://localhost:11434/v1',
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '8192', 10),
      vertex: {
        projectId: process.env.VERTEX_PROJECT_ID || '',
        location: process.env.VERTEX_LOCATION || 'us-central1',
        model: process.env.VERTEX_MODEL || 'gemini-3-flash-preview',
        serviceAccountJson: process.env.VERTEX_SERVICE_ACCOUNT_JSON,
        apiEndpoint: process.env.VERTEX_API_ENDPOINT,
        apiKey: process.env.VERTEX_API_KEY,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-5-nano',
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      },
      grok: {
        apiKey: process.env.GROK_API_KEY,
        model: process.env.GROK_MODEL || 'grok-3-mini',
      },
    },
  }
}
