import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { RATE_LIMITS, LENGTH_LIMITS } from "@shared/limits";
import { encrypt, tryDecrypt } from "@server/lib/envelope";
import type { Wildcard } from "@/types/schema";

const mutationRL = withRateLimit(
  "wildcards.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

// Fields stored as ciphertext envelopes. Excludes uuid/displayId (used for
// lookups) and meta (JSON; not yet wrapped).
const ENCRYPTED_FIELDS = ["name", "format", "content"] as const;

function requireKey(derivedKey: Buffer | undefined): Buffer {
  if (!derivedKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Derived key unavailable for encrypted operation",
    });
  }
  return derivedKey;
}

function encryptFields<
  T extends Partial<Record<(typeof ENCRYPTED_FIELDS)[number], string>>,
>(input: T, key: Buffer): T {
  const out: Record<string, unknown> = { ...input };
  for (const field of ENCRYPTED_FIELDS) {
    const val = out[field];
    if (typeof val === "string") {
      out[field] = encrypt(val, key);
    }
  }
  return out as T;
}

function decryptWildcard(row: Wildcard, key: Buffer): Wildcard {
  const out: Record<string, unknown> = { ...row };
  for (const field of ENCRYPTED_FIELDS) {
    const val = out[field];
    if (typeof val === "string") {
      out[field] = tryDecrypt(val, key);
    }
  }
  return out as unknown as Wildcard;
}

export const wildcardsRouter = router({
  create: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        uuid: z.string().max(LENGTH_LIMITS.name),
        displayId: z.string().max(LENGTH_LIMITS.displayId),
        name: z.string().max(LENGTH_LIMITS.name),
        format: z.string().max(LENGTH_LIMITS.wildcardFormat),
        content: z.string().max(LENGTH_LIMITS.wildcardContent),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const encrypted = encryptFields(input, key);
      // Return encrypted so the client worker exercises its decrypt path via
      // notifyUpsert. The UI refresh goes through list/get, which decrypt.
      return ctx.storage.createWildcard({
        ...encrypted,
        userId: ctx.userId,
      });
    }),

  get: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const wildcard = await ctx.storage.getWildcard(input.id);
      if (!wildcard) {
        throw new Error("Wildcard not found");
      }
      if (wildcard.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return decryptWildcard(wildcard, key);
    }),

  getByUuid: protectedProcedure
    .input(
      z.object({
        uuid: z.string().max(LENGTH_LIMITS.name),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const wildcard = await ctx.storage.getWildcardByUuid(input.uuid);
      if (!wildcard) {
        throw new Error("Wildcard not found");
      }
      if (wildcard.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return decryptWildcard(wildcard, key);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().max(LENGTH_LIMITS.name).optional(),
        format: z.string().max(LENGTH_LIMITS.wildcardFormat).optional(),
        content: z.string().max(LENGTH_LIMITS.wildcardContent).optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const { id, ...updates } = input;
      const wildcard = await ctx.storage.getWildcard(id);
      if (!wildcard) {
        throw new Error("Wildcard not found");
      }
      if (wildcard.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const encrypted = encryptFields(updates, key);
      return ctx.storage.updateWildcard(id, encrypted);
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const wildcard = await ctx.storage.getWildcard(input.id);
      if (!wildcard) {
        throw new Error("Wildcard not found");
      }
      if (wildcard.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.deleteWildcard(input.id);
      return { success: true };
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const result = await ctx.storage.listWildcards(
        ctx.userId,
        input ? { limit: input.limit, offset: input.offset } : undefined,
      );
      return {
        ...result,
        items: result.items.map((w) => decryptWildcard(w, key)),
      };
    }),

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().max(LENGTH_LIMITS.searchQuery).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      // NOTE: server-side LIKE search on name/content is effectively broken
      // once those columns hold ciphertext. Migrate this page to local
      // (worker-side) search before relying on this endpoint for encrypted
      // rows. Plaintext legacy rows will still match.
      const result = await ctx.storage.searchWildcards(
        {
          query: input.query,
        },
        ctx.userId,
        { limit: input.limit, offset: input.offset },
      );
      return {
        ...result,
        items: result.items.map((w) => decryptWildcard(w, key)),
      };
    }),
});
