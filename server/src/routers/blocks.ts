import { z } from 'zod'
import { router, publicProcedure } from '@server/trpc'

export const blocksRouter = router({
  create: publicProcedure
    .input(
      z.object({
        uuid: z.string(),
        name: z.string().optional(),
        displayId: z.string(),
        text: z.string(),
        typeId: z.number().optional(),
        labels: z.array(z.string()).optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.createBlock({
        ...input,
        userId: ctx.userId,
      })
    }),

  get: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.getBlock(input.id)
    }),

  getByUuid: publicProcedure
    .input(
      z.object({
        uuid: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.getBlockByUuid(input.uuid)
    }),

  getWithRevisions: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.getBlockWithRevisions(input.id)
    }),

  getRevisions: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.getRevisions(input.id)
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        displayId: z.string().optional(),
        text: z.string().optional(),
        typeId: z.number().optional(),
        labels: z.array(z.string()).optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input
      return ctx.storage.updateBlock(id, updates)
    }),

  setActiveRevision: publicProcedure
    .input(
      z.object({
        blockId: z.number(),
        revisionId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.setActiveRevision(input.blockId, input.revisionId)
    }),

  delete: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.storage.deleteBlock(input.id)
      return { success: true }
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.storage.listBlocks(ctx.userId)
  }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        typeId: z.number().optional(),
        labels: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.searchBlocks(
        {
          query: input.query,
          typeId: input.typeId,
          labels: input.labels,
        },
        ctx.userId
      )
    }),
})
