import { z } from "zod";
import { router, protectedProcedure } from "@server/trpc";
import { LENGTH_LIMITS } from "@shared/limits";

export const usersRouter = router({
  getScratchpad: protectedProcedure.query(async ({ ctx }) => {
    const content = await ctx.storage.getUserScratchpad(ctx.userId);
    return { content };
  }),

  setScratchpad: protectedProcedure
    .input(
      z.object({
        content: z.string().max(LENGTH_LIMITS.scratchpad),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.storage.setUserScratchpad(ctx.userId, input.content);
      return { success: true };
    }),

  submitFeedback: protectedProcedure
    .input(
      z.object({
        email: z.string().email().max(254).optional(),
        message: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
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
