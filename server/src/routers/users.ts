import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { LENGTH_LIMITS } from "@shared/limits";
import { verifyTurnstileToken } from "@server/lib/turnstile";
import { encrypt, requireKey, tryDecrypt } from "@server/lib/envelope";

const feedbackRL = withRateLimit("users.submitFeedback", 60_000, 3);

export const usersRouter = router({
  getScratchpad: protectedProcedure.query(async ({ ctx }) => {
    const key = requireKey(ctx.derivedKey);
    const stored = await ctx.storage.getUserScratchpad(ctx.userId);
    const content = stored != null ? tryDecrypt(stored, key) : null;
    return { content };
  }),

  setScratchpad: protectedProcedure
    .input(
      z.object({
        content: z.string().max(LENGTH_LIMITS.scratchpad),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const ciphertext =
        input.content.length > 0 ? encrypt(input.content, key) : "";
      await ctx.storage.setUserScratchpad(ctx.userId, ciphertext);
      return { success: true };
    }),

  submitFeedback: protectedProcedure
    .use(feedbackRL)
    .input(
      z.object({
        email: z.string().email().max(254).optional(),
        message: z.string().min(1).max(5000),
        turnstileToken: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.config.cfTurnstileSecretKey) {
        const valid = await verifyTurnstileToken(
          input.turnstileToken,
          ctx.config.cfTurnstileSecretKey,
        );
        if (!valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Turnstile verification failed",
          });
        }
      }

      if (!ctx.config.adminEmails.length || !ctx.emailService.isConfigured) {
        return { success: false };
      }

      const from = input.email
        ? `user #${ctx.userId} (${input.email})`
        : `user #${ctx.userId}`;

      await ctx.emailService.send({
        to: ctx.config.adminEmails,
        subject: `Feedback from ${from}`,
        text: input.message,
      });

      return { success: true };
    }),
});
