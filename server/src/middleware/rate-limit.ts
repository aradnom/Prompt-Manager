import type { Request, Response, NextFunction, RequestHandler } from "express";
import {
  getClientIp,
  checkRateLimit,
  type RedisClient,
} from "@server/lib/rate-limit";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

/**
 * Create an Express middleware that rate-limits requests by client IP + route.
 * Uses Redis sorted sets for sliding-window counting.
 */
export function createRateLimitMiddleware(
  redis: RedisClient,
  config: RateLimitConfig,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const route = req.path;
    const key = `rl:${ip}:${route}`;

    try {
      const result = await checkRateLimit(
        redis,
        key,
        config.windowMs,
        config.maxRequests,
      );

      // Always set rate limit headers
      res.setHeader("X-RateLimit-Limit", config.maxRequests);
      res.setHeader("X-RateLimit-Remaining", result.remaining);
      res.setHeader(
        "X-RateLimit-Reset",
        Math.ceil((Date.now() + config.windowMs) / 1000),
      );

      if (!result.allowed) {
        const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
        res.setHeader("Retry-After", retryAfterSeconds);
        return res.status(429).json({
          error: "Too many requests. Please try again later.",
          retryAfterSeconds,
        });
      }

      next();
    } catch (error) {
      // If Redis is down, let the request through rather than blocking all auth
      console.error("Rate limit check failed:", error);
      next();
    }
  };
}
