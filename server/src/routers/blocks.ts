import { z } from "zod";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { RATE_LIMITS, LENGTH_LIMITS } from "@shared/limits";

const mutationRL = withRateLimit(
  "blocks.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

export const blocksRouter = router({
  create: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        uuid: z.string().max(LENGTH_LIMITS.name),
        name: z.string().max(LENGTH_LIMITS.name).optional(),
        displayId: z.string().max(LENGTH_LIMITS.displayId),
        text: z.string().max(LENGTH_LIMITS.blockText),
        typeId: z.number().nullish(),
        folderId: z.number().nullish(),
        labels: z
          .array(z.string().max(LENGTH_LIMITS.name))
          .max(LENGTH_LIMITS.labels)
          .optional(),
        notes: z.string().max(LENGTH_LIMITS.notes).nullish(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.createBlock({
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
      const block = await ctx.storage.getBlock(input.id);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return block;
    }),

  getByUuid: protectedProcedure
    .input(
      z.object({
        uuid: z.string().max(LENGTH_LIMITS.name),
      }),
    )
    .query(async ({ input, ctx }) => {
      const block = await ctx.storage.getBlockByUuid(input.uuid);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return block;
    }),

  getWithRevisions: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const blockWithRevisions = await ctx.storage.getBlockWithRevisions(
        input.id,
      );
      if (!blockWithRevisions) {
        throw new Error("Block not found");
      }
      if (blockWithRevisions.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return blockWithRevisions;
    }),

  getRevisions: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Check block ownership first
      const block = await ctx.storage.getBlock(input.id);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.getRevisions(input.id);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().max(LENGTH_LIMITS.name).optional(),
        displayId: z.string().max(LENGTH_LIMITS.displayId).optional(),
        text: z.string().max(LENGTH_LIMITS.blockText).optional(),
        typeId: z.number().nullish(),
        folderId: z.number().nullish(),
        labels: z
          .array(z.string().max(LENGTH_LIMITS.name))
          .max(LENGTH_LIMITS.labels)
          .optional(),
        notes: z.string().max(LENGTH_LIMITS.notes).nullish(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      // Check ownership first
      const block = await ctx.storage.getBlock(id);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.updateBlock(id, updates);
    }),

  setActiveRevision: protectedProcedure
    .input(
      z.object({
        blockId: z.number(),
        revisionId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Check ownership first
      const block = await ctx.storage.getBlock(input.blockId);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.setActiveRevision(input.blockId, input.revisionId);
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Check ownership first
      const block = await ctx.storage.getBlock(input.id);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.deleteBlock(input.id);
      return { success: true };
    }),

  getByIds: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number()).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const blocks = await ctx.storage.getBlocksByIds(input.ids);
      return blocks.filter((b) => b.userId === ctx.userId);
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.listBlocks(
        ctx.userId,
        input ? { limit: input.limit, offset: input.offset } : undefined,
      );
    }),

  count: protectedProcedure.query(async ({ ctx }) => {
    return { count: await ctx.storage.countBlocks(ctx.userId) };
  }),

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().max(LENGTH_LIMITS.searchQuery).optional(),
        typeId: z.number().optional(),
        labels: z
          .array(z.string().max(LENGTH_LIMITS.name))
          .max(LENGTH_LIMITS.labels)
          .optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.searchBlocks(
        {
          query: input.query,
          typeId: input.typeId,
          labels: input.labels,
        },
        ctx.userId,
        { limit: input.limit, offset: input.offset },
      );
    }),

  listWithFolders: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.listBlocksWithFolders(ctx.userId, {
        limit: input.limit,
        offset: input.offset,
      });
    }),
});
