import { Kysely, sql } from "kysely";

/**
 * Drop the unused `meta` column from `block_revisions` and `stack_revisions`.
 *
 * The column existed on both revision tables but was never read or written
 * meaningfully — `stack_revisions.meta` wasn't even reflected in the Kysely
 * types, and `block_revisions.meta` only copied through the parent block's
 * meta on insert without any consumer reading it back. Removing it avoids
 * having to reason about encryption for a dead field.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE block_revisions DROP COLUMN IF EXISTS meta`.execute(db);
  await sql`ALTER TABLE stack_revisions DROP COLUMN IF EXISTS meta`.execute(db);
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // Intentionally no-op: the column was unused, so there's nothing to restore.
  // Re-add with `ALTER TABLE ... ADD COLUMN meta json` manually if needed.
}
