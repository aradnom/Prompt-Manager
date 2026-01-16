import { z } from 'zod'
import { router, publicProcedure } from '@server/trpc'

export const wildcardsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        uuid: z.string(),
        displayId: z.string(),
        name: z.string(),
        format: z.string(),
        content: z.string(),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.createWildcard({
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
      return ctx.storage.getWildcard(input.id)
    }),

  getByUuid: publicProcedure
    .input(
      z.object({
        uuid: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.getWildcardByUuid(input.uuid)
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        format: z.string().optional(),
        content: z.string().optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input
      return ctx.storage.updateWildcard(id, updates)
    }),

  delete: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.storage.deleteWildcard(input.id)
      return { success: true }
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.storage.listWildcards(ctx.userId)
  }),
})
