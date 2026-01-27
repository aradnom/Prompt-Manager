import "dotenv/config";
import express from "express";
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

// Re-export notifyStackUpdate for use by other modules (e.g., stacks router)
export const notifyStackUpdate = _notifyStackUpdate;

async function main() {
  const config = loadConfig();
  const app = express();

  // CORS configuration
  if (config.nodeEnv === "development") {
    app.use(
      cors({
        origin: "http://localhost:5173", // Frontend dev server
        credentials: true, // Allow cookies to be sent
      }),
    );
  } else {
    app.use(cors());
  }
  app.use(express.json());
  app.use(cookieParser());

  // Initialize Redis client for sessions
  const redisClient = createClient({
    url: config.sessionDatabaseUrl,
  });
  redisClient.on("error", (err) => console.error("Redis Client Error", err));
  await redisClient.connect();
  console.debug("✓ Redis connection established");

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
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      },
    }),
  );

  const storage = new PostgresStorageAdapter(config.databaseUrl);
  const llmService = new LLMService(config.llm);

  await storage.initialize();
  console.debug("✓ Database connection established");
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
  registerIntegrationRoutes(app, storage);
  registerAuthRoutes(app, storage, config);
  registerSystemRoutes(app);

  app.listen(config.port, () => {
    console.debug(`✓ Server listening on http://localhost:${config.port}`);
    console.debug(`✓ tRPC endpoint: http://localhost:${config.port}/trpc`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
