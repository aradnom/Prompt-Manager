import { z } from 'zod'
import { router, publicProcedure } from '@server/trpc'

export const revisionsRouter = router({
  create: publicProcedure
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

  list: publicProcedure
    .input(
      z.object({
        blockId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.getRevisions(input.blockId)
    }),
})
