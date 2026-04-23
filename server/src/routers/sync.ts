import { z } from "zod";
import { router, protectedProcedure } from "@server/trpc";

/**
 * Bulk-export procedures that back the client-side search cache.
 *
 * Each procedure returns rows the client hasn't seen yet (`updated_at > since`,
 * or everything if `since` is omitted) plus the full set of currently-existing
 * row ids so the client can evict anything that was deleted server-side.
 *
 * `serverTime` is the authoritative cursor the client should send back as
 * `since` on its next call — using the client's clock instead would mean
 * drifting by however far the local clock is off from the DB.
 */

const SinceInput = z.object({
  since: z.string().datetime().optional(),
});

function parseSince(since: string | undefined): Date | undefined {
  return since ? new Date(since) : undefined;
}

export const syncRouter = router({
  exportBlocks: protectedProcedure
    .input(SinceInput)
    .query(async ({ input, ctx }) => {
      const serverTime = new Date().toISOString();
      const result = await ctx.storage.exportBlocksForSync(
        ctx.userId,
        parseSince(input.since),
      );
      return { ...result, serverTime };
    }),

  exportStacks: protectedProcedure
    .input(SinceInput)
    .query(async ({ input, ctx }) => {
      const serverTime = new Date().toISOString();
      const result = await ctx.storage.exportStacksForSync(
        ctx.userId,
        parseSince(input.since),
      );
      return { ...result, serverTime };
    }),

  exportSnapshots: protectedProcedure
    .input(SinceInput)
    .query(async ({ input, ctx }) => {
      const serverTime = new Date().toISOString();
      const result = await ctx.storage.exportStackSnapshotsForSync(
        ctx.userId,
        parseSince(input.since),
      );
      return { ...result, serverTime };
    }),

  exportWildcards: protectedProcedure
    .input(SinceInput)
    .query(async ({ input, ctx }) => {
      const serverTime = new Date().toISOString();
      const result = await ctx.storage.exportWildcardsForSync(
        ctx.userId,
        parseSince(input.since),
      );
      return { ...result, serverTime };
    }),

  exportTemplates: protectedProcedure
    .input(SinceInput)
    .query(async ({ input, ctx }) => {
      const serverTime = new Date().toISOString();
      const result = await ctx.storage.exportStackTemplatesForSync(
        ctx.userId,
        parseSince(input.since),
      );
      return { ...result, serverTime };
    }),
});
