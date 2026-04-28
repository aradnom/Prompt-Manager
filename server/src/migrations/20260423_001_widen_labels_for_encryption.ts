import { Kysely, sql } from "kysely";

/**
 * Widen `blocks.labels` from `varchar(255)[]` to `varchar(1024)[]` so each
 * element can hold an AES-256-GCM envelope (`{iv, authTag, ciphertext}` JSON,
 * ~80 bytes of overhead + base64 ciphertext). Original plan was HMAC digests
 * in-place, but with all search already client-side via the sync worker there
 * was no reason to keep a separate digest path — encrypt the elements too and
 * filter labels in the worker alongside the rest of search.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE blocks ALTER COLUMN labels TYPE varchar(1024)[]`.execute(
    db,
  );
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // Intentionally no-op: narrowing back to varchar(255)[] would fail for any
  // row whose encrypted labels exceed the prior bound. Restore from backup if
  // a revert is really needed.
}
