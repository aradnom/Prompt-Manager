import { z } from "zod";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { RATE_LIMITS } from "@shared/limits";

const mutationRL = withRateLimit(
  "stackFolders.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

export const stackFoldersRouter = router({
  create: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.createStackFolder({
        ...input,
        userId: ctx.userId,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const folder = await ctx.storage.getStackFolder(input.id);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return folder;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      const folder = await ctx.storage.getStackFolder(id);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.updateStackFolder(id, updates);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const folder = await ctx.storage.getStackFolder(input.id);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.deleteStackFolder(input.id);
      return { success: true };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.storage.listStackFolders(ctx.userId);
  }),

  getStacks: protectedProcedure
    .input(z.object({ folderId: z.number() }))
    .query(async ({ input, ctx }) => {
      const folder = await ctx.storage.getStackFolder(input.folderId);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.getFolderStacks(input.folderId);
    }),
});
