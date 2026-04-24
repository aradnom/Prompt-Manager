import { z } from "zod";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { RATE_LIMITS, LENGTH_LIMITS } from "@shared/limits";
import {
  decryptStringFields,
  encryptStringFields,
  requireKey,
} from "@server/lib/envelope";
import type { BlockRevision } from "@/types/schema";

const mutationRL = withRateLimit(
  "revisions.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

const ENCRYPTED_REVISION_FIELDS = ["text"] as const;

function encryptRevisionFields<T extends Record<string, unknown>>(
  input: T,
  key: Buffer,
): T {
  return encryptStringFields(input, ENCRYPTED_REVISION_FIELDS, key);
}

function decryptRevision(row: BlockRevision, key: Buffer): BlockRevision {
  return decryptStringFields(
    row as unknown as Record<string, unknown>,
    ENCRYPTED_REVISION_FIELDS,
    key,
  ) as unknown as BlockRevision;
}

export const revisionsRouter = router({
  create: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        blockId: z.number(),
        text: z.string().max(LENGTH_LIMITS.blockText),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const encrypted = encryptRevisionFields(input, key);
      return ctx.storage.createRevision({
        ...encrypted,
        userId: ctx.userId,
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        blockId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const block = await ctx.storage.getBlock(input.blockId);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const revisions = await ctx.storage.getRevisions(input.blockId);
      return revisions.map((r) => decryptRevision(r, key));
    }),
});
