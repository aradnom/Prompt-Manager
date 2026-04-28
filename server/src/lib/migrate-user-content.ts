import type { Kysely } from "kysely";
import type { Database } from "@/types/database";
import { deriveEncryptionKey } from "@server/lib/auth";
import {
  encrypt,
  encryptJsonValue,
  isEnvelope,
  isEnvelopeObj,
} from "@server/lib/envelope";

/**
 * One-shot re-encryption pass for a user's content.
 *
 * Router write paths encrypt going forward, and read paths use `tryDecrypt` so
 * plaintext-legacy rows keep working. But the legacy rows themselves sit in
 * the DB as plaintext forever unless something touches them. This walks every
 * encrypted column for a single user and encrypts any value that isn't already
 * an envelope — a no-op on rows that have already been rewritten.
 *
 * Safe to run repeatedly.
 */

export interface EntityReport {
  scanned: number;
  encrypted: number;
}

export type MigrateUserContentResult = Record<string, EntityReport>;

export interface MigrateUserContentParams {
  db: Kysely<Database>;
  userId: number;
  /** Pre-derived key. If absent, pass `token` + `encryptionSalt` instead. */
  derivedKey?: Buffer;
  token?: string;
  encryptionSalt?: string;
}

function maybeEncryptString(value: unknown, key: Buffer): string | null {
  if (typeof value !== "string") return null;
  if (isEnvelope(value)) return null;
  return encrypt(value, key);
}

export async function migrateUserContent(
  params: MigrateUserContentParams,
): Promise<MigrateUserContentResult> {
  const { db, userId } = params;
  const key = await resolveKey(params);

  const report: MigrateUserContentResult = {};

  report.blocks = await migrateBlocks(db, userId, key);
  report.block_revisions = await migrateBlockRevisions(db, userId, key);
  report.stacks = await migrateStacks(db, userId, key);
  report.stack_revisions = await migrateStackRevisions(db, userId, key);
  report.stack_snapshots = await migrateStackSnapshots(db, userId, key);
  report.stack_templates = await migrateStackTemplates(db, userId, key);
  report.wildcards = await migrateWildcards(db, userId, key);
  report.block_folders = await migrateBlockFolders(db, userId, key);
  report.stack_folders = await migrateStackFolders(db, userId, key);
  report.users = await migrateUserScratchpad(db, userId, key);

  return report;
}

async function resolveKey(p: MigrateUserContentParams): Promise<Buffer> {
  if (p.derivedKey) return p.derivedKey;
  if (!p.token || !p.encryptionSalt) {
    throw new Error(
      "migrateUserContent: either derivedKey or (token + encryptionSalt) is required",
    );
  }
  return deriveEncryptionKey(p.token, p.encryptionSalt);
}

async function migrateBlocks(
  db: Kysely<Database>,
  userId: number,
  key: Buffer,
): Promise<EntityReport> {
  const rows = await db
    .selectFrom("blocks")
    .select(["id", "name", "notes", "labels", "meta"])
    .where("user_id", "=", userId)
    .execute();

  let encrypted = 0;
  for (const row of rows) {
    const update: Record<string, unknown> = {};

    const name = maybeEncryptString(row.name, key);
    if (name !== null) update.name = name;
    const notes = maybeEncryptString(row.notes, key);
    if (notes !== null) update.notes = notes;

    if (Array.isArray(row.labels)) {
      let changed = false;
      const nextLabels = row.labels.map((l) => {
        if (typeof l === "string" && !isEnvelope(l)) {
          changed = true;
          return encrypt(l, key);
        }
        return l;
      });
      if (changed) update.labels = nextLabels;
    }

    if (row.meta != null && !isEnvelopeObj(row.meta)) {
      update.meta = JSON.stringify(encryptJsonValue(row.meta, key));
    }

    if (Object.keys(update).length > 0) {
      update.updated_at = new Date();
      await db
        .updateTable("blocks")
        .set(update)
        .where("id", "=", row.id)
        .execute();
      encrypted += 1;
    }
  }
  return { scanned: rows.length, encrypted };
}

async function migrateBlockRevisions(
  db: Kysely<Database>,
  userId: number,
  key: Buffer,
): Promise<EntityReport> {
  const rows = await db
    .selectFrom("block_revisions")
    .select(["id", "text"])
    .where("user_id", "=", userId)
    .execute();

  let encrypted = 0;
  for (const row of rows) {
    const text = maybeEncryptString(row.text, key);
    if (text !== null) {
      await db
        .updateTable("block_revisions")
        .set({ text, updated_at: new Date() })
        .where("id", "=", row.id)
        .execute();
      encrypted += 1;
    }
  }
  return { scanned: rows.length, encrypted };
}

async function migrateStacks(
  db: Kysely<Database>,
  userId: number,
  key: Buffer,
): Promise<EntityReport> {
  const rows = await db
    .selectFrom("stacks")
    .select(["id", "name", "notes"])
    .where("user_id", "=", userId)
    .execute();

  let encrypted = 0;
  for (const row of rows) {
    const update: Record<string, unknown> = {};
    const name = maybeEncryptString(row.name, key);
    if (name !== null) update.name = name;
    const notes = maybeEncryptString(row.notes, key);
    if (notes !== null) update.notes = notes;
    if (Object.keys(update).length > 0) {
      update.updated_at = new Date();
      await db
        .updateTable("stacks")
        .set(update)
        .where("id", "=", row.id)
        .execute();
      encrypted += 1;
    }
  }
  return { scanned: rows.length, encrypted };
}

async function migrateStackRevisions(
  db: Kysely<Database>,
  userId: number,
  key: Buffer,
): Promise<EntityReport> {
  const rows = await db
    .selectFrom("stack_revisions")
    .select(["id", "rendered_content"])
    .where("user_id", "=", userId)
    .execute();

  let encrypted = 0;
  for (const row of rows) {
    const rendered = maybeEncryptString(row.rendered_content, key);
    if (rendered !== null) {
      await db
        .updateTable("stack_revisions")
        .set({ rendered_content: rendered, updated_at: new Date() })
        .where("id", "=", row.id)
        .execute();
      encrypted += 1;
    }
  }
  return { scanned: rows.length, encrypted };
}

async function migrateStackSnapshots(
  db: Kysely<Database>,
  userId: number,
  key: Buffer,
): Promise<EntityReport> {
  const rows = await db
    .selectFrom("stack_snapshots")
    .select(["id", "name", "notes", "rendered_content"])
    .where("user_id", "=", userId)
    .execute();

  let encrypted = 0;
  for (const row of rows) {
    const update: Record<string, unknown> = {};
    const name = maybeEncryptString(row.name, key);
    if (name !== null) update.name = name;
    const notes = maybeEncryptString(row.notes, key);
    if (notes !== null) update.notes = notes;
    const rendered = maybeEncryptString(row.rendered_content, key);
    if (rendered !== null) update.rendered_content = rendered;
    if (Object.keys(update).length > 0) {
      update.updated_at = new Date();
      await db
        .updateTable("stack_snapshots")
        .set(update)
        .where("id", "=", row.id)
        .execute();
      encrypted += 1;
    }
  }
  return { scanned: rows.length, encrypted };
}

async function migrateStackTemplates(
  db: Kysely<Database>,
  userId: number,
  key: Buffer,
): Promise<EntityReport> {
  const rows = await db
    .selectFrom("stack_templates")
    .select(["id", "name", "notes"])
    .where("user_id", "=", userId)
    .execute();

  let encrypted = 0;
  for (const row of rows) {
    const update: Record<string, unknown> = {};
    const name = maybeEncryptString(row.name, key);
    if (name !== null) update.name = name;
    const notes = maybeEncryptString(row.notes, key);
    if (notes !== null) update.notes = notes;
    if (Object.keys(update).length > 0) {
      update.updated_at = new Date();
      await db
        .updateTable("stack_templates")
        .set(update)
        .where("id", "=", row.id)
        .execute();
      encrypted += 1;
    }
  }
  return { scanned: rows.length, encrypted };
}

async function migrateWildcards(
  db: Kysely<Database>,
  userId: number,
  key: Buffer,
): Promise<EntityReport> {
  const rows = await db
    .selectFrom("wildcards")
    .select(["id", "name", "format", "content", "meta"])
    .where("user_id", "=", userId)
    .execute();

  let encrypted = 0;
  for (const row of rows) {
    const update: Record<string, unknown> = {};
    const name = maybeEncryptString(row.name, key);
    if (name !== null) update.name = name;
    const format = maybeEncryptString(row.format, key);
    if (format !== null) update.format = format;
    const content = maybeEncryptString(row.content, key);
    if (content !== null) update.content = content;
    if (row.meta != null && !isEnvelopeObj(row.meta)) {
      update.meta = JSON.stringify(encryptJsonValue(row.meta, key));
    }
    if (Object.keys(update).length > 0) {
      update.updated_at = new Date();
      await db
        .updateTable("wildcards")
        .set(update)
        .where("id", "=", row.id)
        .execute();
      encrypted += 1;
    }
  }
  return { scanned: rows.length, encrypted };
}

async function migrateBlockFolders(
  db: Kysely<Database>,
  userId: number,
  key: Buffer,
): Promise<EntityReport> {
  const rows = await db
    .selectFrom("block_folders")
    .select(["id", "name", "description"])
    .where("user_id", "=", userId)
    .execute();

  let encrypted = 0;
  for (const row of rows) {
    const update: Record<string, unknown> = {};
    const name = maybeEncryptString(row.name, key);
    if (name !== null) update.name = name;
    const description = maybeEncryptString(row.description, key);
    if (description !== null) update.description = description;
    if (Object.keys(update).length > 0) {
      update.updated_at = new Date();
      await db
        .updateTable("block_folders")
        .set(update)
        .where("id", "=", row.id)
        .execute();
      encrypted += 1;
    }
  }
  return { scanned: rows.length, encrypted };
}

async function migrateStackFolders(
  db: Kysely<Database>,
  userId: number,
  key: Buffer,
): Promise<EntityReport> {
  const rows = await db
    .selectFrom("stack_folders")
    .select(["id", "name", "description"])
    .where("user_id", "=", userId)
    .execute();

  let encrypted = 0;
  for (const row of rows) {
    const update: Record<string, unknown> = {};
    const name = maybeEncryptString(row.name, key);
    if (name !== null) update.name = name;
    const description = maybeEncryptString(row.description, key);
    if (description !== null) update.description = description;
    if (Object.keys(update).length > 0) {
      update.updated_at = new Date();
      await db
        .updateTable("stack_folders")
        .set(update)
        .where("id", "=", row.id)
        .execute();
      encrypted += 1;
    }
  }
  return { scanned: rows.length, encrypted };
}

async function migrateUserScratchpad(
  db: Kysely<Database>,
  userId: number,
  key: Buffer,
): Promise<EntityReport> {
  const row = await db
    .selectFrom("users")
    .select(["id", "scratchpad"])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!row) return { scanned: 0, encrypted: 0 };

  const scratchpad = maybeEncryptString(row.scratchpad, key);
  if (scratchpad === null) return { scanned: 1, encrypted: 0 };

  await db
    .updateTable("users")
    .set({ scratchpad, updated_at: new Date() })
    .where("id", "=", userId)
    .execute();
  return { scanned: 1, encrypted: 1 };
}
