import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("stack_snapshots")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("display_id", "varchar(255)", (col) => col.notNull())
    .addColumn("name", "varchar(255)")
    .addColumn("notes", "varchar(4000)")
    .addColumn("rendered_content", "text", (col) => col.notNull())
    .addColumn("block_ids", sql`integer[]`, (col) =>
      col.defaultTo(sql`'{}'::integer[]`),
    )
    .addColumn("disabled_block_ids", sql`integer[]`, (col) =>
      col.defaultTo(sql`'{}'::integer[]`),
    )
    .addColumn("stack_id", "integer", (col) =>
      col.references("stacks.id").onDelete("cascade").onUpdate("cascade"),
    )
    .addColumn("user_id", "integer", (col) =>
      col.references("users.id").onDelete("set null").onUpdate("cascade"),
    )
    .addColumn("created_at", "timestamptz")
    .addColumn("updated_at", "timestamptz")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("stack_snapshots").execute();
}
