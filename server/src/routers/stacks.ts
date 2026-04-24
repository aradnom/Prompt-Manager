import { z } from "zod";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { generateDisplayId } from "@server/lib/generate-display-id";
import { RATE_LIMITS, LENGTH_LIMITS } from "@shared/limits";
import {
  decryptStringFields,
  encrypt,
  encryptStringFields,
  requireKey,
} from "@server/lib/envelope";
import { decryptBlockWithRevisions } from "@server/routers/blocks";
import type {
  BlockStack,
  StackRevision,
  StackSnapshot,
  StackWithBlocks,
} from "@/types/schema";

const mutationRL = withRateLimit(
  "stacks.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

// String-typed fields stored as ciphertext envelopes. `renderedContent` lives
// on `stack_revisions` (not `stacks`), so it's handled out-of-band from this
// list. `displayId`/`uuid` stay plaintext (lookups).
const ENCRYPTED_STACK_FIELDS = ["name", "notes"] as const;

function encryptStackFields<T extends Record<string, unknown>>(
  input: T,
  key: Buffer,
): T {
  return encryptStringFields(input, ENCRYPTED_STACK_FIELDS, key);
}

export function decryptStack<T extends BlockStack | StackWithBlocks>(
  row: T,
  key: Buffer,
): T {
  const withStrings = decryptStringFields(
    row as unknown as Record<string, unknown>,
    ENCRYPTED_STACK_FIELDS,
    key,
  );
  // `folderName` is joined from `stack_folders.name`, which is ciphertext.
  const base = decryptStringFields(
    withStrings,
    ["folderName"],
    key,
  ) as unknown as T;

  if ("blocks" in base && Array.isArray((base as StackWithBlocks).blocks)) {
    const expanded = base as StackWithBlocks;
    return {
      ...expanded,
      blocks: expanded.blocks.map((b) => decryptBlockWithRevisions(b, key)),
      revisions: expanded.revisions.map((r) => decryptStackRevision(r, key)),
    } as unknown as T;
  }

  return base;
}

function decryptStackRevision(row: StackRevision, key: Buffer): StackRevision {
  return decryptStringFields(
    row as unknown as Record<string, unknown>,
    ["renderedContent"],
    key,
  ) as unknown as StackRevision;
}

// Snapshots are fully static — fields are captured at snapshot time and never
// recomputed. All three user-visible strings encrypt cleanly.
const ENCRYPTED_SNAPSHOT_FIELDS = ["name", "notes", "renderedContent"] as const;

function encryptSnapshotFields<T extends Record<string, unknown>>(
  input: T,
  key: Buffer,
): T {
  return encryptStringFields(input, ENCRYPTED_SNAPSHOT_FIELDS, key);
}

function decryptSnapshot(row: StackSnapshot, key: Buffer): StackSnapshot {
  const base = decryptStringFields(
    row as unknown as Record<string, unknown>,
    ENCRYPTED_SNAPSHOT_FIELDS,
    key,
  ) as unknown as StackSnapshot;
  // `stackName` is joined from `stacks.name`, which is also ciphertext.
  if (base.stackName != null) {
    return decryptStringFields(
      base as unknown as Record<string, unknown>,
      ["stackName"],
      key,
    ) as unknown as StackSnapshot;
  }
  return base;
}

export const stacksRouter = router({
  create: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        uuid: z.string().max(LENGTH_LIMITS.name),
        name: z.string().max(LENGTH_LIMITS.name).optional(),
        displayId: z.string().max(LENGTH_LIMITS.displayId),
        commaSeparated: z.boolean().optional(),
        negative: z.boolean().optional(),
        style: z.enum(["t5", "clip"]).nullable().optional(),
        blockIds: z.array(z.number()).max(LENGTH_LIMITS.blockIds).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const encrypted = encryptStackFields(input, key);
      return ctx.storage.createStack({
        ...encrypted,
        userId: ctx.userId,
      });
    }),

  get: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        includeBlocks: z.boolean().optional().default(false),
        includeRevisions: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.id, {
        includeBlocks: input.includeBlocks,
        includeRevisions: input.includeRevisions,
      });
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return decryptStack(stack, key);
    }),

  getByUuid: protectedProcedure
    .input(
      z.object({
        uuid: z.string().max(LENGTH_LIMITS.name),
        includeBlocks: z.boolean().optional().default(false),
        includeRevisions: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStackByUuid(input.uuid, {
        includeBlocks: input.includeBlocks,
        includeRevisions: input.includeRevisions,
      });
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return decryptStack(stack, key);
    }),

  getByDisplayId: protectedProcedure
    .input(
      z.object({
        displayId: z.string().max(LENGTH_LIMITS.displayId),
        includeBlocks: z.boolean().optional().default(false),
        includeRevisions: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStackByDisplayId(
        input.displayId,
        ctx.userId,
        {
          includeBlocks: input.includeBlocks,
          includeRevisions: input.includeRevisions,
        },
      );
      if (!stack) {
        throw new Error("Stack not found");
      }
      return decryptStack(stack, key);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().max(LENGTH_LIMITS.name).optional(),
        displayId: z.string().max(LENGTH_LIMITS.displayId).optional(),
        commaSeparated: z.boolean().optional(),
        negative: z.boolean().optional(),
        style: z.enum(["t5", "clip"]).nullable().optional(),
        notes: z.string().max(LENGTH_LIMITS.notes).nullable().optional(),
        folderId: z.number().nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const { id, ...updates } = input;
      const stack = await ctx.storage.getStack(id);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const encrypted = encryptStackFields(updates, key);
      return ctx.storage.updateStack(id, encrypted);
    }),

  duplicate: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.id);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const duplicated = await ctx.storage.duplicateStack(input.id);
      return decryptStack(duplicated, key);
    }),

  setActiveRevision: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
        revisionId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const updated = await ctx.storage.setActiveStackRevision(
        input.stackId,
        input.revisionId,
      );
      return decryptStack(updated, key);
    }),

  getRevisions: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const revisions = await ctx.storage.getStackRevisions(input.stackId);
      return revisions.map((r) => decryptStackRevision(r, key));
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const stack = await ctx.storage.getStack(input.id);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.deleteStack(input.id);
      return { success: true };
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const result = await ctx.storage.listStacks(
        ctx.userId,
        input ? { limit: input.limit, offset: input.offset } : undefined,
      );
      return {
        ...result,
        items: result.items.map((s) => decryptStack(s, key)),
      };
    }),

  listWithFolders: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const result = await ctx.storage.listStacksWithFolders(ctx.userId, {
        limit: input.limit,
        offset: input.offset,
      });
      // Folder names remain plaintext until the folders pass. Only the
      // contained stacks need decryption.
      return {
        ...result,
        looseStacks: result.looseStacks.map((s) => decryptStack(s, key)),
      };
    }),

  count: protectedProcedure.query(async ({ ctx }) => {
    return { count: await ctx.storage.countStacks(ctx.userId) };
  }),

  // NOT CURRENTLY USED BY THE UI for text matching. Client-side worker search
  // is the real entry point; server-side LIKE can't match encrypted columns.
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().max(LENGTH_LIMITS.searchQuery).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const result = await ctx.storage.searchStacks(
        { query: input.query },
        ctx.userId,
        { limit: input.limit, offset: input.offset },
      );
      return {
        ...result,
        items: result.items.map((s) => decryptStack(s, key)),
      };
    }),

  addBlock: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
        blockId: z.number(),
        order: z.number().optional(),
        renderedContent: z
          .string()
          .max(LENGTH_LIMITS.renderedContent)
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const encryptedRendered =
        input.renderedContent !== undefined
          ? encrypt(input.renderedContent, key)
          : undefined;
      await ctx.storage.addBlockToStack(
        input.stackId,
        input.blockId,
        input.order,
        encryptedRendered,
      );
      return { success: true };
    }),

  removeBlock: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
        blockId: z.number(),
        renderedContent: z
          .string()
          .max(LENGTH_LIMITS.renderedContent)
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const encryptedRendered =
        input.renderedContent !== undefined
          ? encrypt(input.renderedContent, key)
          : undefined;
      await ctx.storage.removeBlockFromStack(
        input.stackId,
        input.blockId,
        encryptedRendered,
      );
      return { success: true };
    }),

  reorderBlocks: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
        blockIds: z.array(z.number()).max(LENGTH_LIMITS.blockIds),
        renderedContent: z
          .string()
          .max(LENGTH_LIMITS.renderedContent)
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const encryptedRendered =
        input.renderedContent !== undefined
          ? encrypt(input.renderedContent, key)
          : undefined;
      await ctx.storage.reorderStackBlocks(
        input.stackId,
        input.blockIds,
        encryptedRendered,
      );
      return { success: true };
    }),

  toggleBlockDisabled: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
        blockId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.toggleBlockDisabledInStack(
        input.stackId,
        input.blockId,
      );
      return { success: true };
    }),

  updateContent: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
        renderedContent: z.string().max(LENGTH_LIMITS.renderedContent),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      // Ciphertext on the wire for both DB write and SSE push — the CUI node
      // holds the derived key (via pairing) and decrypts on its end. `stack`
      // here is the raw row (ciphertext name) so the SSE payload is envelope-
      // shaped everywhere the CUI nodes expect.
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }

      const encryptedRendered = encrypt(input.renderedContent, key);
      await ctx.storage.updateStackRevisionContent(
        input.stackId,
        encryptedRendered,
      );

      if (ctx.userId) {
        const { notifyStackUpdate } = await import("@server/index");
        notifyStackUpdate(
          ctx.userId,
          stack.displayId,
          stack.name,
          encryptedRendered,
        );
      }

      return { success: true };
    }),

  notifyActiveStack: protectedProcedure
    .input(
      z.object({
        stackId: z.number().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.storage.setUserActiveStackId(ctx.userId, input.stackId);

      if (input.stackId === null) {
        const { notifyActiveStackChanged } = await import("@server/index");
        notifyActiveStackChanged(ctx.userId, null, null, null);
        return { success: true };
      }

      // Raw ciphertext pass-through. CUI nodes decrypt envelope name/prompt on
      // their end, so the router never needs the key here.
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }

      const renderedContent = await ctx.storage.getRenderedPrompt(
        stack.displayId,
        ctx.userId,
      );

      const { notifyActiveStackChanged } = await import("@server/index");
      notifyActiveStackChanged(
        ctx.userId,
        stack.displayId,
        stack.name,
        renderedContent,
      );
      return { success: true };
    }),

  createSnapshot: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        stackId: z.number(),
        renderedContent: z.string().max(LENGTH_LIMITS.renderedContent),
        name: z.string().max(LENGTH_LIMITS.name).optional(),
        notes: z.string().max(LENGTH_LIMITS.notes).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }

      const encrypted = encryptSnapshotFields(
        {
          name: input.name,
          notes: input.notes,
          renderedContent: input.renderedContent,
        },
        key,
      );
      const created = await ctx.storage.createStackSnapshot({
        displayId: generateDisplayId(),
        name: encrypted.name,
        notes: encrypted.notes,
        renderedContent: encrypted.renderedContent,
        blockIds: stack.blockIds,
        disabledBlockIds: stack.disabledBlockIds,
        stackId: input.stackId,
        userId: ctx.userId,
      });
      return decryptSnapshot(created, key);
    }),

  listSnapshots: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const snapshots = await ctx.storage.listStackSnapshots(input.stackId);
      return snapshots.map((s) => decryptSnapshot(s, key));
    }),

  updateSnapshot: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        stackId: z.number(),
        name: z.string().max(LENGTH_LIMITS.name).nullable().optional(),
        notes: z.string().max(LENGTH_LIMITS.notes).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const { id, stackId: _stackId, ...updates } = input;
      const encrypted = encryptStringFields(
        updates as Record<string, unknown>,
        ["name", "notes"],
        key,
      );
      const updated = await ctx.storage.updateStackSnapshot(id, encrypted);
      return decryptSnapshot(updated, key);
    }),

  deleteSnapshot: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        stackId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.deleteStackSnapshot(input.id);
      return { success: true };
    }),

  listAllSnapshots: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const result = await ctx.storage.listAllSnapshots(ctx.userId, {
        limit: input.limit,
        offset: input.offset,
      });
      return {
        ...result,
        items: result.items.map((s) => decryptSnapshot(s, key)),
      };
    }),

  // NOT CURRENTLY USED BY THE UI for text matching.
  //
  // Snapshot name/notes/renderedContent are all ciphertext, so server-side
  // ILIKE can't match them. The Snapshots UI uses the sync worker's MiniSearch
  // index instead. Endpoint kept for plaintext-legacy rows and non-UI consumers.
  searchSnapshots: protectedProcedure
    .input(
      z.object({
        query: z.string().max(LENGTH_LIMITS.searchQuery).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const result = await ctx.storage.searchSnapshots(
        { query: input.query },
        ctx.userId,
        {
          limit: input.limit,
          offset: input.offset,
        },
      );
      return {
        ...result,
        items: result.items.map((s) => decryptSnapshot(s, key)),
      };
    }),
});
