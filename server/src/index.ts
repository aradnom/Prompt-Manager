import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { PostgresStorageAdapter } from "@server/adapters/postgres-adapter";
import { createContext } from "@server/trpc";
import { appRouter } from "@server/routers";
import { loadConfig } from "@server/config";
import { LLMService } from "@server/services/llm-service";
import { registerAuthRoutes } from "@server/express-routes/auth";
import {
  registerIntegrationRoutes,
  notifyStackUpdate as _notifyStackUpdate,
} from "@server/express-routes/integrations";
import { registerSystemRoutes } from "@server/express-routes/system";
import { createRateLimitMiddleware } from "@server/middleware/rate-limit";
import { checkPendingMigrations } from "@server/lib/migration-check";

// Re-export notifyStackUpdate for use by other modules (e.g., stacks router)
export const notifyStackUpdate = _notifyStackUpdate;

async function main() {
  const config = loadConfig();
  const app = express();

  // Trust proxy (GKE load balancer terminates TLS)
  if (config.nodeEnv === "production") {
    app.set("trust proxy", 1);
  }

  // CORS configuration
  if (process.env.CORS_ORIGINS) {
    const origins = process.env.CORS_ORIGINS.split(",").map((s) => s.trim());
    app.use(cors({ origin: origins, credentials: true }));
  } else if (config.nodeEnv === "development") {
    app.use(cors({ origin: true, credentials: true }));
  }
  app.use(express.json());
  app.use(cookieParser());

  // Initialize Redis client for sessions
  const redisClient = createClient({
    url: config.sessionDatabaseUrl,
  });
  redisClient.on("error", (err) => console.error("Redis Client Error", err));
  await redisClient.connect();
  console.debug("✓ Redis session connection established");

  // Initialize Redis client for rate limiting (separate DB)
  const rateLimitRedis = createClient({
    url: config.rateLimitDatabaseUrl,
  });
  rateLimitRedis.on("error", (err) =>
    console.error("Redis Rate Limit Client Error", err),
  );
  await rateLimitRedis.connect();
  console.debug("✓ Redis rate limit connection established");

  // Initialize session store
  const redisStore = new RedisStore({
    client: redisClient,
    prefix: "sess:",
  });

  // Configure session middleware
  app.use(
    session({
      store: redisStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.nodeEnv !== "development",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      },
    }),
  );

  const storage = new PostgresStorageAdapter(config.databaseUrl);
  const llmService = new LLMService(config.llm);

  await storage.initialize();
  console.debug("✓ Database connection established");

  await checkPendingMigrations(config.databaseUrl);
  console.debug("✓ LLM service initialized");
  console.debug(
    `  Allowed targets: ${Array.from(config.llm.allowedTargets).join(", ")}`,
  );

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: createContext(storage, llmService, config),
    }),
  );

  // Register route handlers
  const rateLimiter = createRateLimitMiddleware(rateLimitRedis, {
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests,
  });
  registerIntegrationRoutes(app, storage, config);
  registerAuthRoutes(app, storage, config, rateLimiter);
  registerSystemRoutes(app);

  // Serve static frontend in production
  if (config.nodeEnv === "production") {
    const distPath = path.resolve(
      new URL(".", import.meta.url).pathname,
      "../../dist",
    );
    app.use(express.static(distPath));
    app.get("*splat", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(config.port, () => {
    console.debug(`✓ Server listening on port ${config.port}`);
    console.debug(`✓ tRPC endpoint available at /trpc`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
