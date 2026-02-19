import {
  Kysely,
  PostgresDialect,
  Migrator,
  FileMigrationProvider,
} from "kysely";
import { Pool } from "pg";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    "postgresql://promptuser:promptpass@localhost:5432/prompt_manager";

  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "migrations"),
    }),
  });

  const command = process.argv[2];

  if (command === "down") {
    const { error, results } = await migrator.migrateDown();
    results?.forEach((r) => {
      if (r.status === "Success") {
        console.info(`Rolled back: ${r.migrationName}`);
      } else if (r.status === "Error") {
        console.error(`Failed to roll back: ${r.migrationName}`);
      }
    });
    if (error) {
      console.error("Migration rollback failed:", error);
      process.exit(1);
    }
  } else {
    const { error, results } = await migrator.migrateToLatest();
    results?.forEach((r) => {
      if (r.status === "Success") {
        console.info(`Migrated: ${r.migrationName}`);
      } else if (r.status === "Error") {
        console.error(`Failed: ${r.migrationName}`);
      }
    });
    if (error) {
      console.error("Migration failed:", error);
      process.exit(1);
    }
    if (!results?.length) {
      console.info("Already up to date.");
    }
  }

  await db.destroy();
}

run();
