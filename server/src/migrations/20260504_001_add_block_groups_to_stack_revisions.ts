import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE stack_revisions
    ADD COLUMN block_groups text DEFAULT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE stack_revisions DROP COLUMN block_groups`.execute(db);
}
