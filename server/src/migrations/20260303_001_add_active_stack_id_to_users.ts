import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("active_stack_id", "integer", (col) =>
      col.references("stacks.id").onDelete("set null").onUpdate("cascade"),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("users").dropColumn("active_stack_id").execute();
}
