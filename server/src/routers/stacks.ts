import { z } from "zod";
import { router, protectedProcedure } from "@server/trpc";

export const stacksRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        uuid: z.string(),
        name: z.string().optional(),
        displayId: z.string(),
        commaSeparated: z.boolean().optional(),
        style: z.enum(["t5", "clip"]).nullable().optional(),
        blockIds: z.array(z.number()).optional(),
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
        uuid: z.string(),
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

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        displayId: z.string().optional(),
        commaSeparated: z.boolean().optional(),
        style: z.enum(["t5", "clip"]).nullable().optional(),
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

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.storage.listStacks(ctx.userId);
  }),

  count: protectedProcedure.query(async ({ ctx }) => {
    return { count: await ctx.storage.countStacks(ctx.userId) };
  }),

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.searchStacks(
        {
          query: input.query,
        },
        ctx.userId,
      );
    }),

  addBlock: protectedProcedure
    .input(
      z.object({
        stackId: z.number(),
        blockId: z.number(),
        order: z.number().optional(),
        renderedContent: z.string().optional(),
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
        renderedContent: z.string().optional(),
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
        blockIds: z.array(z.number()),
        renderedContent: z.string().optional(),
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
        renderedContent: z.string(),
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
});
