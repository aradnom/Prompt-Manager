import { z } from 'zod'
import { router, publicProcedure } from '@server/trpc'

const llmTargetSchema = z.enum(['lm-studio', 'openai', 'anthropic', 'vertex'])

export const llmRouter = router({
  transform: publicProcedure
    .input(
      z.object({
        text: z.string(),
        operation: z.string(),
        target: llmTargetSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.llmService.transform({
        text: input.text,
        operation: input.operation,
        target: input.target,
      })
    }),
})
