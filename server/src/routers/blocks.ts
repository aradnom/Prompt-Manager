import { z } from "zod";
import { router, protectedProcedure } from "@server/trpc";

export const blocksRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        uuid: z.string(),
        name: z.string().optional(),
        displayId: z.string(),
        text: z.string(),
        typeId: z.number().optional(),
        labels: z.array(z.string()).optional(),
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
        uuid: z.string(),
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
        name: z.string().optional(),
        displayId: z.string().optional(),
        text: z.string().optional(),
        typeId: z.number().optional(),
        labels: z.array(z.string()).optional(),
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

  list: protectedProcedure
    .input(
      z.object({
        countOnly: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (input.countOnly) {
        return { count: await ctx.storage.countBlocks(ctx.userId) };
      }
      return ctx.storage.listBlocks(ctx.userId);
    }),

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        typeId: z.number().optional(),
        labels: z.array(z.string()).optional(),
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
      );
    }),
});
