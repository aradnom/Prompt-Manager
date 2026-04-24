import { z } from "zod";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { RATE_LIMITS, LENGTH_LIMITS } from "@shared/limits";
import {
  decryptMetaField,
  decryptStringFields,
  encrypt,
  encryptMetaField,
  encryptStringFields,
  requireKey,
  tryDecrypt,
} from "@server/lib/envelope";
import type { Block, BlockRevision, BlockWithRevisions } from "@/types/schema";

const mutationRL = withRateLimit(
  "blocks.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

// String-typed fields stored as ciphertext envelopes. `text` is written to
// both `blocks` (derived column) and `block_revisions` inside one transaction,
// so a single envelope covers both. `labels` is an array: each element is
// encrypted independently (handled below).
const ENCRYPTED_BLOCK_FIELDS = ["name", "notes", "text"] as const;
const ENCRYPTED_REVISION_FIELDS = ["text"] as const;

function encryptBlockFields<T extends Record<string, unknown>>(
  input: T,
  key: Buffer,
): T {
  const withStrings = encryptStringFields(input, ENCRYPTED_BLOCK_FIELDS, key);
  const withMeta = encryptMetaField(withStrings, key);
  const labels = (withMeta as { labels?: unknown }).labels;
  if (Array.isArray(labels)) {
    return {
      ...withMeta,
      labels: labels.map((l) => (typeof l === "string" ? encrypt(l, key) : l)),
    } as T;
  }
  return withMeta;
}

export function decryptBlock(row: Block, key: Buffer): Block {
  const base = decryptMetaField(
    decryptStringFields(
      row as unknown as Record<string, unknown>,
      ENCRYPTED_BLOCK_FIELDS,
      key,
    ),
    key,
  );
  const labels = (base as { labels?: unknown }).labels;
  if (Array.isArray(labels)) {
    return {
      ...base,
      labels: labels.map((l) =>
        typeof l === "string" ? tryDecrypt(l, key) : l,
      ),
    } as unknown as Block;
  }
  return base as unknown as Block;
}

function decryptRevision(row: BlockRevision, key: Buffer): BlockRevision {
  return decryptStringFields(
    row as unknown as Record<string, unknown>,
    ENCRYPTED_REVISION_FIELDS,
    key,
  ) as unknown as BlockRevision;
}

export function decryptBlockWithRevisions(
  row: BlockWithRevisions,
  key: Buffer,
): BlockWithRevisions {
  const block = decryptBlock(row, key);
  return {
    ...block,
    revisions: row.revisions.map((r) => decryptRevision(r, key)),
  };
}

export const blocksRouter = router({
  create: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        uuid: z.string().max(LENGTH_LIMITS.name),
        name: z.string().max(LENGTH_LIMITS.name).optional(),
        displayId: z.string().max(LENGTH_LIMITS.displayId),
        text: z.string().max(LENGTH_LIMITS.blockText),
        typeId: z.number().nullish(),
        folderId: z.number().nullish(),
        labels: z
          .array(z.string().max(LENGTH_LIMITS.name))
          .max(LENGTH_LIMITS.labels)
          .optional(),
        notes: z.string().max(LENGTH_LIMITS.notes).nullish(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const encrypted = encryptBlockFields(input, key);
      return ctx.storage.createBlock({
        ...encrypted,
        userId: ctx.userId,
      });
    }),

  get: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const block = await ctx.storage.getBlock(input.id);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return decryptBlock(block, key);
    }),

  getByUuid: protectedProcedure
    .input(
      z.object({
        uuid: z.string().max(LENGTH_LIMITS.name),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const block = await ctx.storage.getBlockByUuid(input.uuid);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return decryptBlock(block, key);
    }),

  getWithRevisions: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const blockWithRevisions = await ctx.storage.getBlockWithRevisions(
        input.id,
      );
      if (!blockWithRevisions) {
        throw new Error("Block not found");
      }
      if (blockWithRevisions.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return decryptBlockWithRevisions(blockWithRevisions, key);
    }),

  getRevisions: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const block = await ctx.storage.getBlock(input.id);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const revisions = await ctx.storage.getRevisions(input.id);
      return revisions.map((r) => decryptRevision(r, key));
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().max(LENGTH_LIMITS.name).optional(),
        displayId: z.string().max(LENGTH_LIMITS.displayId).optional(),
        text: z.string().max(LENGTH_LIMITS.blockText).optional(),
        typeId: z.number().nullish(),
        folderId: z.number().nullish(),
        labels: z
          .array(z.string().max(LENGTH_LIMITS.name))
          .max(LENGTH_LIMITS.labels)
          .optional(),
        notes: z.string().max(LENGTH_LIMITS.notes).nullish(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const { id, ...updates } = input;
      const block = await ctx.storage.getBlock(id);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const encrypted = encryptBlockFields(updates, key);
      return ctx.storage.updateBlock(id, encrypted);
    }),

  setActiveRevision: protectedProcedure
    .input(
      z.object({
        blockId: z.number(),
        revisionId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const block = await ctx.storage.getBlock(input.blockId);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const updated = await ctx.storage.setActiveRevision(
        input.blockId,
        input.revisionId,
      );
      return decryptBlock(updated, key);
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const block = await ctx.storage.getBlock(input.id);
      if (!block) {
        throw new Error("Block not found");
      }
      if (block.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.deleteBlock(input.id);
      return { success: true };
    }),

  getByIds: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number()).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const blocks = await ctx.storage.getBlocksByIds(input.ids);
      return blocks
        .filter((b) => b.userId === ctx.userId)
        .map((b) => decryptBlock(b, key));
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const result = await ctx.storage.listBlocks(
        ctx.userId,
        input ? { limit: input.limit, offset: input.offset } : undefined,
      );
      return {
        ...result,
        items: result.items.map((b) => decryptBlock(b, key)),
      };
    }),

  count: protectedProcedure.query(async ({ ctx }) => {
    return { count: await ctx.storage.countBlocks(ctx.userId) };
  }),

  // NOT CURRENTLY USED BY THE UI.
  //
  // Client-side search (via the sync worker's MiniSearch index) is the real
  // entry point — server-side LIKE can't match encrypted `name`/`notes`/`text`,
  // and labels are now per-element ciphertext so `@>` can't match them either.
  // The `typeId` filter still works. Endpoint kept for plaintext-legacy rows
  // and non-UI consumers.
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().max(LENGTH_LIMITS.searchQuery).optional(),
        typeId: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const result = await ctx.storage.searchBlocks(
        {
          query: input.query,
          typeId: input.typeId,
        },
        ctx.userId,
        { limit: input.limit, offset: input.offset },
      );
      return {
        ...result,
        items: result.items.map((b) => decryptBlock(b, key)),
      };
    }),

  listWithFolders: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const result = await ctx.storage.listBlocksWithFolders(ctx.userId, {
        limit: input.limit,
        offset: input.offset,
      });
      // Folder names are plaintext (folder entities aren't yet part of the
      // encryption pass). Only the contained Block rows need decryption.
      return {
        ...result,
        looseBlocks: result.looseBlocks.map((b) => decryptBlock(b, key)),
      };
    }),
});
