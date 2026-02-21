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
});
