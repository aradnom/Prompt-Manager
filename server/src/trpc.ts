import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { IStorageAdapter } from "@server/adapters/storage-adapter.interface";
import type { LLMService } from "@server/services/llm-service";
import { decryptDerivedKey } from "@server/lib/auth";
import { checkRateLimit, type RedisClient } from "@server/lib/rate-limit";

import type { ServerConfig } from "@server/config";

export interface Context {
  storage: IStorageAdapter;
  llmService: LLMService;
  config: ServerConfig;
  rateLimitRedis?: RedisClient;
  userId?: number;
  derivedKey?: Buffer;
}

export const createContext = (
  storage: IStorageAdapter,
  llmService: LLMService,
  config: ServerConfig,
  rateLimitRedis?: RedisClient,
) => {
  return ({ req }: CreateExpressContextOptions): Context => {
    // Get userId from session (established via login/register)
    const userId = req.session?.userId;

    // Try to decrypt the derived key if session and sessionKey cookie exist
    let derivedKey: Buffer | undefined;
    if (req.session?.encryptedDerivedKey && req.cookies?.sessionKey) {
      try {
        derivedKey = decryptDerivedKey(
          req.session.encryptedDerivedKey,
          req.cookies.sessionKey,
        );
      } catch (error) {
        console.error("Failed to decrypt derived key in tRPC context:", error);
      }
    }

    return {
      storage,
      llmService,
      config,
      rateLimitRedis,
      userId,
      derivedKey,
    };
  };
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

// Middleware to check if user is authenticated
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // Now guaranteed to be defined
    },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Create a tRPC middleware that rate-limits by userId.
 * Requires protectedProcedure (userId must be set).
 * Gracefully allows requests through if Redis is unavailable.
 */
export function withRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.rateLimitRedis || !ctx.userId) return next();

    try {
      const redisKey = `rl:user:${ctx.userId}:${key}`;
      const result = await checkRateLimit(
        ctx.rateLimitRedis,
        redisKey,
        windowMs,
        maxRequests,
      );

      if (!result.allowed) {
        const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Try again in ${retryAfterSeconds}s.`,
        });
      }
    } catch (error) {
      // Re-throw TRPCErrors (our own rate limit errors)
      if (error instanceof TRPCError) throw error;
      // If Redis is down, let the request through
      console.error("Rate limit check failed:", error);
    }

    return next();
  });
}
