import type { Request } from "express";
import type { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

/**
 * Extract the real client IP from the request, checking proxy headers
 * in order of specificity for K8s/Cloudflare/reverse proxy environments.
 */
export function getClientIp(req: Request): string {
  const headers: string[] = [
    "x-client-ip",
    "cf-connecting-ip",
    "x-real-ip",
    "x-original-forwarded-for",
    "x-forwarded-for",
  ];

  for (const header of headers) {
    const value = req.headers[header];
    if (value) {
      const ip = (Array.isArray(value) ? value[0] : value).split(",")[0].trim();
      if (ip) return ip;
    }
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check and record a rate-limited action using Redis sorted sets.
 *
 * Each request is stored as a member in a sorted set keyed by IP+route,
 * with the timestamp as the score. Old entries are pruned, and the
 * current count is checked against the limit.
 */
export async function checkRateLimit(
  redis: RedisClient,
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Prune entries outside the window
  await redis.zRemRangeByScore(key, 0, windowStart);

  // Count current entries in the window
  const currentCount = await redis.zCard(key);

  if (currentCount >= maxRequests) {
    // Over the limit — find oldest entry to calculate retry-after
    const oldest = await redis.zRangeWithScores(key, 0, 0);
    const oldestTimestamp = oldest.length > 0 ? oldest[0].score : now;
    const retryAfterMs = Math.ceil(oldestTimestamp + windowMs - now);

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(retryAfterMs, 1),
    };
  }

  // Under the limit — record this request with a unique member
  // Use timestamp + random suffix to avoid collisions on same-ms requests
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;
  await redis.zAdd(key, { score: now, value: member });

  // Set TTL on the key so it self-cleans if no more requests come in
  const ttlSeconds = Math.ceil(windowMs / 1000);
  await redis.expire(key, ttlSeconds);

  return {
    allowed: true,
    remaining: maxRequests - currentCount - 1,
    retryAfterMs: 0,
  };
}
