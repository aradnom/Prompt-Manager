import { z } from 'zod'
import { router, protectedProcedure } from '@server/trpc'
import { decrypt } from '@server/lib/auth'

const llmTargetSchema = z.enum(['lm-studio', 'openai', 'anthropic', 'vertex'])
const outputStyleSchema = z.enum(['t5', 'clip']).nullable().optional()

export const llmRouter = router({
  transform: protectedProcedure
    .input(
      z.object({
        text: z.string(),
        operation: z.string(),
        target: llmTargetSchema,
        style: outputStyleSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Try to get user's API key and model for the target LLM
      let userApiKey: string | undefined
      let userModel: string | undefined

      if (ctx.derivedKey) {
        try {
          const user = await ctx.storage.getUserById(ctx.userId)
          if (user?.accountData?.apiKeys) {
            const decryptedApiKeys = decrypt(user.accountData.apiKeys as string, ctx.derivedKey)
            const apiKeys = JSON.parse(decryptedApiKeys) as Record<string, any>
            const providerData = apiKeys[input.target]

            if (providerData && typeof providerData === 'object') {
              userApiKey = providerData.key
              userModel = providerData.model
            }
          }
        } catch (error) {
          console.error('Failed to decrypt user API keys:', error)
          // Continue without user API key - will use server key
        }
      }

      return ctx.llmService.transform({
        text: input.text,
        operation: input.operation,
        target: input.target,
        style: input.style,
      }, userApiKey, userModel)
    }),
})
