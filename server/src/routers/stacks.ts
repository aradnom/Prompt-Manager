import { z } from 'zod'
import { router, publicProcedure } from '@server/trpc'

export const stacksRouter = router({
  create: publicProcedure
    .input(
      z.object({
        uuid: z.string(),
        name: z.string().optional(),
        displayId: z.string(),
        blockIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.createStack({
        ...input,
        userId: ctx.userId,
      })
    }),

  get: publicProcedure
    .input(
      z.object({
        id: z.number(),
        includeBlocks: z.boolean().optional().default(false),
        includeRevisions: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.getStack(input.id, {
        includeBlocks: input.includeBlocks,
        includeRevisions: input.includeRevisions,
      })
    }),

  getByUuid: publicProcedure
    .input(
      z.object({
        uuid: z.string(),
        includeBlocks: z.boolean().optional().default(false),
        includeRevisions: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.getStackByUuid(input.uuid, {
        includeBlocks: input.includeBlocks,
        includeRevisions: input.includeRevisions,
      })
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        displayId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input
      return ctx.storage.updateStack(id, updates)
    }),

  setActiveRevision: publicProcedure
    .input(
      z.object({
        stackId: z.number(),
        revisionId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.setActiveStackRevision(input.stackId, input.revisionId)
    }),

  getRevisions: publicProcedure
    .input(
      z.object({
        stackId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.getStackRevisions(input.stackId)
    }),

  delete: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.storage.deleteStack(input.id)
      return { success: true }
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.storage.listStacks(ctx.userId)
  }),

  addBlock: publicProcedure
    .input(
      z.object({
        stackId: z.number(),
        blockId: z.number(),
        order: z.number().optional(),
        renderedContent: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.storage.addBlockToStack(input.stackId, input.blockId, input.order, input.renderedContent)
      return { success: true }
    }),

  removeBlock: publicProcedure
    .input(
      z.object({
        stackId: z.number(),
        blockId: z.number(),
        renderedContent: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.storage.removeBlockFromStack(input.stackId, input.blockId, input.renderedContent)
      return { success: true }
    }),

  reorderBlocks: publicProcedure
    .input(
      z.object({
        stackId: z.number(),
        blockIds: z.array(z.number()),
        renderedContent: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.storage.reorderStackBlocks(input.stackId, input.blockIds, input.renderedContent)
      return { success: true }
    }),

  updateContent: publicProcedure
    .input(
      z.object({
        stackId: z.number(),
        renderedContent: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.storage.updateStackRevisionContent(input.stackId, input.renderedContent)

      // Get stack info for SSE notification
      const stack = await ctx.storage.getStack(input.stackId)
      if (stack && ctx.userId) {
        // Import notifyStackUpdate from index
        const { notifyStackUpdate } = await import('@server/index')
        notifyStackUpdate(ctx.userId, stack.displayId, input.renderedContent)
      }

      return { success: true }
    }),
})
