import { z } from "zod";
import { router, protectedProcedure, withRateLimit } from "@server/trpc";
import { generateDisplayId } from "@server/lib/generate-display-id";
import { RATE_LIMITS, LENGTH_LIMITS } from "@shared/limits";
import {
  decryptStringFields,
  encryptStringFields,
  requireKey,
  tryDecrypt,
} from "@server/lib/envelope";
import type { StackTemplate, TextBlockGroup } from "@/types/schema";
import {
  decodeBlockGroups,
  encryptStackBlockGroups,
} from "@server/routers/stacks";

const mutationRL = withRateLimit(
  "stackTemplates.create",
  RATE_LIMITS.mutation.windowMs,
  RATE_LIMITS.mutation.maxRequests,
);

const ENCRYPTED_TEMPLATE_FIELDS = ["name", "notes"] as const;

function encryptTemplateFields<T extends Record<string, unknown>>(
  input: T,
  key: Buffer,
): T {
  return encryptStringFields(input, ENCRYPTED_TEMPLATE_FIELDS, key);
}

function decryptTemplate(row: StackTemplate, key: Buffer): StackTemplate {
  const base = decryptStringFields(
    row as unknown as Record<string, unknown>,
    ENCRYPTED_TEMPLATE_FIELDS,
    key,
  ) as unknown as StackTemplate;
  const raw = (row as unknown as { blockGroups: unknown }).blockGroups;
  return {
    ...base,
    blockGroups: decodeBlockGroups(raw, base.blockIds ?? [], key),
  };
}

const blockGroupsZod = z
  .array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string().nullable(),
      blockIds: z.array(z.number()),
      collapsed: z.boolean(),
    }),
  )
  .nullable()
  .optional();

function encodeBlockGroupsForStorage(
  groups: TextBlockGroup[] | null | undefined,
  key: Buffer,
): string | null | undefined {
  if (groups === undefined) return undefined;
  if (groups === null || groups.length === 0) return null;
  return encryptStackBlockGroups(groups, key);
}

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
        blockGroups: blockGroupsZod,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const { blockGroups, ...rest } = input;
      const encrypted = encryptTemplateFields(rest, key);
      const blockGroupsCipher = encodeBlockGroupsForStorage(blockGroups, key);
      const created = await ctx.storage.createStackTemplate({
        displayId: generateDisplayId(),
        ...encrypted,
        ...(blockGroupsCipher !== undefined
          ? {
              blockGroups: blockGroupsCipher as unknown as
                | TextBlockGroup[]
                | null,
            }
          : {}),
        userId: ctx.userId,
      });
      return decryptTemplate(created, key);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const template = await ctx.storage.getStackTemplate(input.id);
      if (!template) {
        throw new Error("Template not found");
      }
      if (template.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      return decryptTemplate(template, key);
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
        blockGroups: blockGroupsZod,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = requireKey(ctx.derivedKey);
      const template = await ctx.storage.getStackTemplate(input.id);
      if (!template) {
        throw new Error("Template not found");
      }
      if (template.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      const { id, blockGroups, ...rest } = input;
      const encrypted = encryptTemplateFields(rest, key);
      const blockGroupsCipher = encodeBlockGroupsForStorage(blockGroups, key);
      const updated = await ctx.storage.updateStackTemplate(id, {
        ...encrypted,
        ...(blockGroupsCipher !== undefined
          ? {
              blockGroups: blockGroupsCipher as unknown as
                | TextBlockGroup[]
                | null,
            }
          : {}),
      });
      return decryptTemplate(updated, key);
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
      const key = requireKey(ctx.derivedKey);
      const result = await ctx.storage.listStackTemplates(ctx.userId, {
        limit: input.limit,
        offset: input.offset,
      });
      return {
        ...result,
        items: result.items.map((t) => decryptTemplate(t, key)),
      };
    }),

  // NOT CURRENTLY USED BY THE UI for text matching.
  //
  // Server-side ILIKE can't match encrypted `name`/`notes`. The Templates UI
  // uses the sync worker's MiniSearch index. Endpoint kept for plaintext-legacy
  // rows and non-UI consumers.
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
      const result = await ctx.storage.searchStackTemplates(
        { query: input.query },
        ctx.userId,
        { limit: input.limit, offset: input.offset },
      );
      return {
        ...result,
        items: result.items.map((t) => decryptTemplate(t, key)),
      };
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
      const key = requireKey(ctx.derivedKey);
      const stack = await ctx.storage.getStack(input.stackId);
      if (!stack) {
        throw new Error("Stack not found");
      }
      if (stack.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
      // Decrypt the parent stack name so the auto-generated "<name> Template"
      // composes cleanly. Falls back to `null` if the row is still plaintext
      // legacy (tryDecrypt returns the input if it isn't an envelope).
      const stackName = stack.name != null ? tryDecrypt(stack.name, key) : null;
      const composedName =
        input.name ?? (stackName ? `${stackName} Template` : undefined);
      const encrypted = encryptTemplateFields({ name: composedName }, key);
      // `stack.blockGroups` at this layer is the raw cipher string from the
      // active revision (or null) — pass through unchanged so the same encrypted
      // bytes land on the template row.
      const rawGroups = (stack as unknown as { blockGroups: unknown })
        .blockGroups;
      const created = await ctx.storage.createStackTemplate({
        displayId: generateDisplayId(),
        name: encrypted.name,
        blockIds: stack.blockIds,
        disabledBlockIds: stack.disabledBlockIds,
        commaSeparated: stack.commaSeparated,
        negative: stack.negative,
        style: stack.style,
        blockGroups: rawGroups as unknown as TextBlockGroup[] | null,
        userId: ctx.userId,
      });
      return decryptTemplate(created, key);
    }),
});
