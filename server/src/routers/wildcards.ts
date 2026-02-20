import { z } from "zod";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { RATE_LIMITS } from "@shared/limits";

const mutationRL = withRateLimit(
  "wildcards.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

export const wildcardsRouter = router({
  create: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        uuid: z.string(),
        displayId: z.string(),
        name: z.string(),
        format: z.string(),
        content: z.string(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.createWildcard({
        ...input,
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
      const wildcard = await ctx.storage.getWildcard(input.id);
      if (!wildcard) {
        throw new Error("Wildcard not found");
      }
      if (wildcard.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return wildcard;
    }),

  getByUuid: protectedProcedure
    .input(
      z.object({
        uuid: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const wildcard = await ctx.storage.getWildcardByUuid(input.uuid);
      if (!wildcard) {
        throw new Error("Wildcard not found");
      }
      if (wildcard.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return wildcard;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        format: z.string().optional(),
        content: z.string().optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      // Check ownership first
      const wildcard = await ctx.storage.getWildcard(id);
      if (!wildcard) {
        throw new Error("Wildcard not found");
      }
      if (wildcard.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.updateWildcard(id, updates);
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Check ownership first
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
      return ctx.storage.listWildcards(
        ctx.userId,
        input ? { limit: input.limit, offset: input.offset } : undefined,
      );
    }),

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.searchWildcards(
        {
          query: input.query,
        },
        ctx.userId,
        { limit: input.limit, offset: input.offset },
      );
    }),
});
