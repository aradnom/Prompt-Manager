import { z } from "zod";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { generateDisplayId } from "@server/lib/generate-display-id";
import { RATE_LIMITS, LENGTH_LIMITS } from "@shared/limits";

const mutationRL = withRateLimit(
  "stacks.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

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
      return ctx.storage.createStack({
        ...input,
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
      return stack;
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
      return stack;
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
      return stack;
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
      const { id, ...updates } = input;
      // Check ownership first
      const stack = await ctx.storage.getStack(id);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.updateStack(id, updates);
    }),

  duplicate: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Check ownership first
      const stack = await ctx.storage.getStack(input.id);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.duplicateStack(input.id);
    }),

  setActiveRevision: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
        revisionId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Check ownership first
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.setActiveStackRevision(
        input.stackId,
        input.revisionId,
      );
    }),

  getRevisions: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Check stack ownership first
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.getStackRevisions(input.stackId);
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Check ownership first
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
      return ctx.storage.listStacks(
        ctx.userId,
        input ? { limit: input.limit, offset: input.offset } : undefined,
      );
    }),

  listWithFolders: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.listStacksWithFolders(ctx.userId, {
        limit: input.limit,
        offset: input.offset,
      });
    }),

  count: protectedProcedure.query(async ({ ctx }) => {
    return { count: await ctx.storage.countStacks(ctx.userId) };
  }),

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().max(LENGTH_LIMITS.searchQuery).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.searchStacks(
        {
          query: input.query,
        },
        ctx.userId,
        { limit: input.limit, offset: input.offset },
      );
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
      // Check stack ownership first
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.addBlockToStack(
        input.stackId,
        input.blockId,
        input.order,
        input.renderedContent,
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
      // Check stack ownership first
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.removeBlockFromStack(
        input.stackId,
        input.blockId,
        input.renderedContent,
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
      // Check stack ownership first
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.reorderStackBlocks(
        input.stackId,
        input.blockIds,
        input.renderedContent,
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
      // Check stack ownership first
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }

      await ctx.storage.updateStackRevisionContent(
        input.stackId,
        input.renderedContent,
      );

      // Send SSE notification
      if (ctx.userId) {
        const { notifyStackUpdate } = await import("@server/index");
        notifyStackUpdate(ctx.userId, stack.displayId, input.renderedContent);
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
        notifyActiveStackChanged(ctx.userId, null, null);
        return { success: true };
      }

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
      notifyActiveStackChanged(ctx.userId, stack.displayId, renderedContent);
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
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }

      return ctx.storage.createStackSnapshot({
        displayId: generateDisplayId(),
        name: input.name,
        notes: input.notes,
        renderedContent: input.renderedContent,
        blockIds: stack.blockIds,
        disabledBlockIds: stack.disabledBlockIds,
        stackId: input.stackId,
        userId: ctx.userId,
      });
    }),

  listSnapshots: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return ctx.storage.listStackSnapshots(input.stackId);
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
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const { id, ...updates } = input;
      return ctx.storage.updateStackSnapshot(id, updates);
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
      return ctx.storage.listAllSnapshots(ctx.userId, {
        limit: input.limit,
        offset: input.offset,
      });
    }),

  searchSnapshots: protectedProcedure
    .input(
      z.object({
        query: z.string().max(LENGTH_LIMITS.searchQuery).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.searchSnapshots({ query: input.query }, ctx.userId, {
        limit: input.limit,
        offset: input.offset,
      });
    }),
});
