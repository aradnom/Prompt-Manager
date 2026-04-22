import { router, publicProcedure } from "@server/trpc";
import { LLM_TARGETS } from "@server/config";

export const configRouter = router({
  getSettings: publicProcedure.query(async ({ ctx }) => {
    return {
      llm: {
        allowedTargets: Array.from(ctx.config.llm.allowedTargets),
        allTargets: Array.from(LLM_TARGETS),
      },
      turnstileSiteKey: ctx.config.cfTurnstileSiteKey ?? null,
      encryptionSalt: ctx.config.encryptionSalt,
    };
  }),
});
