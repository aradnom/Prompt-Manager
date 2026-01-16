import { z } from 'zod'
import { router, publicProcedure } from '@server/trpc'

export const typesRouter = router({
  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.createType(input.name, input.description)
    }),

  get: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.getType(input.id)
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.storage.listTypes()
  }),
})
