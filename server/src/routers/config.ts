import { router, publicProcedure } from '@server/trpc'

export const configRouter = router({
  getSettings: publicProcedure.query(async ({ ctx }) => {
    return {
      devSettingsEnabled: process.env.DEV_SETTINGS === 'true',
      llm: {
        allowedTargets: Array.from(ctx.config.llm.allowedTargets),
      },
    }
  }),
})
