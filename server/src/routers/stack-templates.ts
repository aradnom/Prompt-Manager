import { z } from "zod";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { generateDisplayId } from "@server/lib/generate-display-id";
import { RATE_LIMITS, LENGTH_LIMITS } from "@shared/limits";

const mutationRL = withRateLimit(
  "stackTemplates.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

export const stackTemplatesRouter = router({
  create: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        name: z.string().max(LENGTH_LIMITS.name).optional(),
        blockIds: z.array(z.number()).max(LENGTH_LIMITS.blockIds).optional(),
        disabledBlockIds: z
          .array(z.number())
          .max(LENGTH_LIMITS.blockIds)
          .optional(),
        commaSeparated: z.boolean().optional(),
        negative: z.boolean().optional(),
        style: z.enum(["t5", "clip"]).nullable().optional(),
        notes: z.string().max(LENGTH_LIMITS.notes).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.storage.createStackTemplate({
        displayId: generateDisplayId(),
        ...input,
        userId: ctx.userId,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const template = await ctx.storage.getStackTemplate(input.id);
      if (!template) {
        throw new Error("Template not found");
      }
      if (template.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return template;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().max(LENGTH_LIMITS.name).nullable().optional(),
        blockIds: z.array(z.number()).max(LENGTH_LIMITS.blockIds).optional(),
        disabledBlockIds: z
          .array(z.number())
          .max(LENGTH_LIMITS.blockIds)
          .optional(),
        commaSeparated: z.boolean().optional(),
        negative: z.boolean().optional(),
        style: z.enum(["t5", "clip"]).nullable().optional(),
        notes: z.string().max(LENGTH_LIMITS.notes).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const template = await ctx.storage.getStackTemplate(input.id);
      if (!template) {
        throw new Error("Template not found");
      }
      if (template.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const { id, ...updates } = input;
      return ctx.storage.updateStackTemplate(id, updates);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const template = await ctx.storage.getStackTemplate(input.id);
      if (!template) {
        throw new Error("Template not found");
      }
      if (template.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      await ctx.storage.deleteStackTemplate(input.id);
      return { success: true };
    }),

  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      return ctx.storage.listStackTemplates(ctx.userId, {
        limit: input.limit,
        offset: input.offset,
      });
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
      return ctx.storage.searchStackTemplates(
        { query: input.query },
        ctx.userId,
        { limit: input.limit, offset: input.offset },
      );
    }),

  createFromStack: protectedProcedure
    .use(mutationRL)
    .input(
      z.object({
        stackId: z.number(),
        name: z.string().max(LENGTH_LIMITS.name).optional(),
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
      return ctx.storage.createStackTemplate({
        displayId: generateDisplayId(),
        name: input.name ?? (stack.name ? `${stack.name} Template` : undefined),
        blockIds: stack.blockIds,
        disabledBlockIds: stack.disabledBlockIds,
        commaSeparated: stack.commaSeparated,
        negative: stack.negative,
        style: stack.style,
        userId: ctx.userId,
      });
    }),
});
