import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE stacks
    ADD COLUMN labels varchar(1024)[] DEFAULT '{}'::varchar(1024)[]
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE stacks DROP COLUMN labels`.execute(db);
}
