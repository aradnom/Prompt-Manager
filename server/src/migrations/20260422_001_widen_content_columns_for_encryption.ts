import { Kysely, sql } from "kysely";

/**
 * Widen every bounded varchar column that carries user-authored content to
 * `text`, so it can hold the AES-256-GCM ciphertext envelope (~40% larger
 * than plaintext, plus ~80 bytes of iv+authTag+JSON overhead).
 *
 * Fields left alone: display_id / uuid (non-content, stay plaintext);
 * stacks.style (enum-ish structural flag); blocks.labels (will be stored as
 * per-user HMAC digests, which fit comfortably in varchar(255)).
 */

const TARGETS: Array<[table: string, column: string]> = [
  ["blocks", "name"],
  ["blocks", "notes"],
  ["stacks", "name"],
  ["stacks", "notes"],
  ["stack_snapshots", "name"],
  ["stack_snapshots", "notes"],
  ["stack_templates", "name"],
  ["stack_templates", "notes"],
  ["wildcards", "name"],
  ["wildcards", "format"],
  ["block_folders", "name"],
  ["block_folders", "description"],
  ["stack_folders", "name"],
  ["stack_folders", "description"],
];

export async function up(db: Kysely<any>): Promise<void> {
  for (const [table, column] of TARGETS) {
    await sql`ALTER TABLE ${sql.ref(table)} ALTER COLUMN ${sql.ref(column)} TYPE text`.execute(
      db,
    );
  }
}

export async function down(_db: Kysely<any>): Promise<void> {
  // Intentionally no-op: narrowing back to the original varchar(N) limits
  // would fail for any row whose ciphertext already exceeds those bounds,
  // and there is no safe generic width to pick. Restore from backup if you
  // really need to revert.
}
