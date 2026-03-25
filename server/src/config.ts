// Define LLM targets as const array - single source of truth
export const LLM_TARGETS = [
  "lm-studio",
  "openai",
  "anthropic",
  "vertex",
  "grok",
] as const;
export type LLMTarget = (typeof LLM_TARGETS)[number];

export interface LLMConfig {
  allowedTargets: Set<string>;
  lmStudioUrl: string;
  maxTokens: number;
  vertex: {
    projectId: string;
    location: string;
    model: string;
    serviceAccountJson?: string;
    apiEndpoint?: string;
    apiKey?: string;
  };
  openai: {
    apiKey?: string;
    model: string;
  };
  anthropic: {
    apiKey?: string;
    model: string;
  };
  grok: {
    apiKey?: string;
    model: string;
  };
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  sessionDatabaseUrl: string;
  sessionSecret: string;
  encryptionSalt: string;
  tokenSecret: string;
  rateLimitDatabaseUrl: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  llm: LLMConfig;
  resendApiKey?: string;
  adminEmails: string[];
  notificationDatabaseUrl: string;
}

function parseAllowedTargets(envValue: string | undefined): Set<string> {
  if (!envValue) return new Set(LLM_TARGETS);
  return new Set(envValue.split(",").map((t) => t.trim()));
}

// When running inside Docker, localhost URLs need to point to the host machine
function resolveLocalhost(url: string): string {
  return url.replace(/localhost/g, process.env.DOCKER_HOST || "localhost");
}

export function loadConfig(): ServerConfig {
  const requiredSecrets = [
    "SESSION_SECRET",
    "ENCRYPTION_SALT",
    "TOKEN_SECRET",
  ] as const;

  for (const secret of requiredSecrets) {
    if (!process.env[secret]) {
      throw new Error(`${secret} environment variable is required`);
    }
  }

  return {
    port: parseInt(process.env.PORT || "3001", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    databaseUrl: resolveLocalhost(
      process.env.DATABASE_URL ||
        "postgresql://promptuser:promptpass@localhost:5432/prompt_manager",
    ),
    sessionDatabaseUrl: resolveLocalhost(
      process.env.SESSION_DATABASE_URL || "redis://localhost:6379/0",
    ),
    sessionSecret: process.env.SESSION_SECRET!,
    encryptionSalt: process.env.ENCRYPTION_SALT!,
    tokenSecret: process.env.TOKEN_SECRET!,
    rateLimitDatabaseUrl: resolveLocalhost(
      process.env.RATE_LIMIT_DATABASE_URL || "redis://localhost:6379/1",
    ),
    rateLimitWindowMs: parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || "60000",
      10,
    ),
    rateLimitMaxRequests: parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || "10",
      10,
    ),
    resendApiKey: process.env.RESEND_API_KEY,
    adminEmails: process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((s) => s.trim())
      : [],
    notificationDatabaseUrl: resolveLocalhost(
      process.env.NOTIFICATION_DATABASE_URL || "redis://localhost:6379/2",
    ),
    llm: {
      allowedTargets: parseAllowedTargets(process.env.LLM_ALLOWED_TARGETS),
      lmStudioUrl: resolveLocalhost(
        process.env.LM_STUDIO_URL || "http://localhost:11434/v1",
      ),
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || "8192", 10),
      vertex: {
        projectId: process.env.VERTEX_PROJECT_ID || "",
        location: process.env.VERTEX_LOCATION || "us-central1",
        model: process.env.VERTEX_MODEL || "gemini-3-flash-preview",
        serviceAccountJson: process.env.VERTEX_SERVICE_ACCOUNT_JSON,
        apiEndpoint: process.env.VERTEX_API_ENDPOINT,
        apiKey: process.env.VERTEX_API_KEY,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || "gpt-5-nano",
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
      },
      grok: {
        apiKey: process.env.GROK_API_KEY,
        model: process.env.GROK_MODEL || "grok-3-mini",
      },
    },
  };
}
