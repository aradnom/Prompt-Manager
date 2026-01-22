import { z } from 'zod'
import { router, publicProcedure } from '@server/trpc'

const llmTargetSchema = z.enum(['lm-studio', 'openai', 'anthropic', 'vertex'])
const outputStyleSchema = z.enum(['t5', 'clip']).nullable().optional()

export const llmRouter = router({
  transform: publicProcedure
    .input(
      z.object({
        text: z.string(),
        operation: z.string(),
        target: llmTargetSchema,
        style: outputStyleSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.llmService.transform({
        text: input.text,
        operation: input.operation,
        target: input.target,
        style: input.style,
      })
    }),
})
