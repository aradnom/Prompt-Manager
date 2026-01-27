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
      // Determine which target to use
      let targetToUse = input.target

      // Try to get user's active platform preference and API keys
      let userApiKey: string | undefined
      let userModel: string | undefined

      if (ctx.derivedKey) {
        try {
          const user = await ctx.storage.getUserById(ctx.userId)

          // Check if user has set an active platform preference
          if (user?.accountData?.activeLLMPlatform) {
            const activePlatform = decrypt(user.accountData.activeLLMPlatform as string, ctx.derivedKey)
            // Use the user's active platform if it's valid
            if (['lm-studio', 'openai', 'anthropic', 'vertex'].includes(activePlatform)) {
              targetToUse = activePlatform as 'lm-studio' | 'openai' | 'anthropic' | 'vertex'
            }
          }

          if (user?.accountData?.apiKeys) {
            const decryptedApiKeys = decrypt(user.accountData.apiKeys as string, ctx.derivedKey)
            const apiKeys = JSON.parse(decryptedApiKeys) as Record<string, any>
            const providerData = apiKeys[targetToUse]

            if (providerData && typeof providerData === 'object') {
              userApiKey = providerData.key
              userModel = providerData.model
            }
          }
        } catch (error) {
          console.error('Failed to decrypt user data:', error)
          // Continue without user preferences - will use input target and server key
        }
      }

      console.debug(`Performing LLM operation ${input.operation} with platform ${targetToUse}, model ${userModel}`);

      return ctx.llmService.transform({
        text: input.text,
        operation: input.operation,
        target: targetToUse,
        style: input.style,
      }, userApiKey, userModel)
    }),
})
