import { z } from "zod";
import { router, protectedProcedure } from "@server/trpc";

export const blockFoldersRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.createBlockFolder({
        ...input,
        userId: ctx.userId,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const folder = await ctx.storage.getBlockFolder(input.id);
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
      const folder = await ctx.storage.getBlockFolder(id);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.updateBlockFolder(id, updates);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const folder = await ctx.storage.getBlockFolder(input.id);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.deleteBlockFolder(input.id);
      return { success: true };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.storage.listBlockFolders(ctx.userId);
  }),

  getBlocks: protectedProcedure
    .input(z.object({ folderId: z.number() }))
    .query(async ({ input, ctx }) => {
      const folder = await ctx.storage.getBlockFolder(input.folderId);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.getFolderBlocks(input.folderId);
    }),
});
