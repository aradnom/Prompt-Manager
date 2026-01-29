import { z } from "zod";
import { router, protectedProcedure } from "@server/trpc";
import { decrypt } from "@server/lib/auth";
import { LLM_TARGETS, type LLMTarget } from "@server/config";
import type { LLMOperation } from "@shared/llm/types";

const LLM_OPERATIONS: [LLMOperation, ...LLMOperation[]] = [
  "more-descriptive",
  "less-descriptive",
  "variation-slight",
  "variation-fair",
  "variation-very",
  "explore",
  "generate",
  "generate-wildcard",
  "auto-label",
];

const llmTargetSchema = z.enum(LLM_TARGETS);
const llmOperationSchema = z.enum(LLM_OPERATIONS);
const outputStyleSchema = z.enum(["t5", "clip"]).nullable().optional();

export const llmRouter = router({
  transform: protectedProcedure
    .input(
      z.object({
        text: z.string(),
        operation: llmOperationSchema,
        target: llmTargetSchema,
        style: outputStyleSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Determine which target to use
      let targetToUse = input.target;

      // Try to get user's active platform preference and API keys
      let userApiKey: string | undefined;
      let userModel: string | undefined;

      if (ctx.derivedKey) {
        try {
          const user = await ctx.storage.getUserById(ctx.userId);

          // Check if user has set an active platform preference
          if (user?.accountData?.activeLLMPlatform) {
            const activePlatform = decrypt(
              user.accountData.activeLLMPlatform as string,
              ctx.derivedKey,
            );
            // Use the user's active platform if it's valid
            if (LLM_TARGETS.includes(activePlatform as LLMTarget)) {
              targetToUse = activePlatform as LLMTarget;
            }
          }

          if (user?.accountData?.apiKeys) {
            const decryptedApiKeys = decrypt(
              user.accountData.apiKeys as string,
              ctx.derivedKey,
            );
            const apiKeys = JSON.parse(decryptedApiKeys) as Record<
              string,
              { key?: string; model?: string }
            >;
            const providerData = apiKeys[targetToUse];

            if (providerData) {
              userApiKey = providerData.key;
              userModel = providerData.model;
            }
          }
        } catch (error) {
          console.error("Failed to decrypt user data:", error);
          // Continue without user preferences - will use input target and server key
        }
      }

      console.debug(
        `Performing LLM operation ${input.operation} with platform ${targetToUse}, model ${userModel}`,
      );

      return ctx.llmService.transform(
        {
          text: input.text,
          operation: input.operation,
          target: targetToUse,
          style: input.style,
        },
        userApiKey,
        userModel,
      );
    }),
});
