export interface LLMConfig {
  allowedTargets: Set<string>
  lmStudioUrl: string
  vertex: {
    projectId: string
    location: string
    model: string
    serviceAccountJson?: string
    apiEndpoint?: string
    apiKey?: string
  }
}

export interface ServerConfig {
  port: number
  nodeEnv: string
  databaseUrl: string
  sessionDatabaseUrl: string
  sessionSecret: string
  llm: LLMConfig
}

function parseAllowedTargets(envValue: string | undefined): Set<string> {
  if (!envValue) return new Set(['lm-studio', 'vertex'])
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
    llm: {
      allowedTargets: parseAllowedTargets(process.env.LLM_ALLOWED_TARGETS),
      lmStudioUrl: process.env.LM_STUDIO_URL || 'http://localhost:11434/v1',
      vertex: {
        projectId: process.env.VERTEX_PROJECT_ID || '',
        location: process.env.VERTEX_LOCATION || 'us-central1',
        model: process.env.VERTEX_MODEL || 'gemini-3-flash-preview',
        serviceAccountJson: process.env.VERTEX_SERVICE_ACCOUNT_JSON,
        apiEndpoint: process.env.VERTEX_API_ENDPOINT,
        apiKey: process.env.VERTEX_API_KEY,
      },
    },
  }
}
