import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@server/trpc";
import { rejectPairRequest, resolvePairRequest } from "@server/lib/cui-pair";

export const integrationsRouter = router({
  denyPair: protectedProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
      }),
    )
    .mutation(({ input, ctx }) => {
      const resolved = resolvePairRequest(input.requestId, ctx.userId, {
        ok: false,
        reason: "denied",
      });
      return { resolved };
    }),

  // Confirms a pending CUI pair request by unwrapping the caller's derived
  // key (reconstructed in the tRPC context from the sessionKey cookie +
  // encryptedDerivedKey in session) and handing it to the waiting CUI request.
  // The key exists in server memory only for the duration of this mutation —
  // not persisted, not logged.
  confirmPair: protectedProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
      }),
    )
    .mutation(({ input, ctx }) => {
      if (!ctx.derivedKey) {
        // Reject the waiting CUI request so it gets a 500 rather than hanging
        // until timeout or being misreported as a user denial.
        rejectPairRequest(
          input.requestId,
          ctx.userId,
          new Error("Encryption key unavailable for this session"),
        );
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Encryption key unavailable for this session. Please log in again.",
        });
      }

      const resolved = resolvePairRequest(input.requestId, ctx.userId, {
        ok: true,
        derivedKey: ctx.derivedKey.toString("base64"),
      });
      return { resolved };
    }),
});
