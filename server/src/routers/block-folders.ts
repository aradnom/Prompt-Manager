import { z } from "zod";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { RATE_LIMITS, LENGTH_LIMITS } from "@shared/limits";
import {
  decryptStringFields,
  encryptStringFields,
  requireKey,
} from "@server/lib/envelope";
import { decryptBlock } from "@server/routers/blocks";
import type { BlockFolder } from "@/types/schema";

const mutationRL = withRateLimit(
  "blockFolders.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

const ENCRYPTED_FOLDER_FIELDS = ["name", "description"] as const;

function encryptFolderFields<T extends Record<string, unknown>>(
  input: T,
  key: Buffer,
): T {
  return encryptStringFields(input, ENCRYPTED_FOLDER_FIELDS, key);
}

export function decryptFolder(row: BlockFolder, key: Buffer): BlockFolder {
  return decryptStringFields(
    row as unknown as Record<string, unknown>,
    ENCRYPTED_FOLDER_FIELDS,
    key,
  ) as unknown as BlockFolder;
}

export const blockFoldersRouter = router({
  create: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        name: z.string().max(LENGTH_LIMITS.name),
        description: z.string().max(LENGTH_LIMITS.folderDescription).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const encrypted = encryptFolderFields(input, key);
      const created = await ctx.storage.createBlockFolder({
        ...encrypted,
        userId: ctx.userId,
      });
      return decryptFolder(created, key);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const folder = await ctx.storage.getBlockFolder(input.id);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return decryptFolder(folder, key);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().max(LENGTH_LIMITS.name).optional(),
        description: z.string().max(LENGTH_LIMITS.folderDescription).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const { id, ...updates } = input;
      const folder = await ctx.storage.getBlockFolder(id);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const encrypted = encryptFolderFields(updates, key);
      const updated = await ctx.storage.updateBlockFolder(id, encrypted);
      return decryptFolder(updated, key);
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
    const key = requireKey(ctx.derivedKey);
    const folders = await ctx.storage.listBlockFolders(ctx.userId);
    return folders.map((f) => decryptFolder(f, key));
  }),

  getBlocks: protectedProcedure
    .input(z.object({ folderId: z.number() }))
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const folder = await ctx.storage.getBlockFolder(input.folderId);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const blocks = await ctx.storage.getFolderBlocks(input.folderId);
      return blocks.map((b) => decryptBlock(b, key));
    }),
});
