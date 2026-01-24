import { z } from 'zod'
import { router, protectedProcedure } from '@server/trpc'

export const revisionsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        blockId: z.number(),
        text: z.string(),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.createRevision({
        ...input,
        userId: ctx.userId,
      })
    }),

  list: protectedProcedure
    .input(
      z.object({
        blockId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Check block ownership first
      const block = await ctx.storage.getBlock(input.blockId)
      if (!block) {
        throw new Error('Block not found')
      }
      if (block.userId !== ctx.userId) {
        throw new Error('Unauthorized')
      }
      return ctx.storage.getRevisions(input.blockId)
    }),
})
