import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("stack_templates")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("display_id", "varchar(255)", (col) => col.notNull())
    .addColumn("name", "varchar(255)")
    .addColumn("block_ids", sql`integer[]`, (col) =>
      col.defaultTo(sql`'{}'::integer[]`),
    )
    .addColumn("disabled_block_ids", sql`integer[]`, (col) =>
      col.defaultTo(sql`'{}'::integer[]`),
    )
    .addColumn("comma_separated", "boolean", (col) => col.defaultTo(true))
    .addColumn("negative", "boolean", (col) => col.defaultTo(false))
    .addColumn("style", "varchar(32)")
    .addColumn("notes", "varchar(4000)")
    .addColumn("user_id", "integer", (col) =>
      col.references("users.id").onDelete("set null").onUpdate("cascade"),
    )
    .addColumn("created_at", "timestamptz")
    .addColumn("updated_at", "timestamptz")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("stack_templates").execute();
}
