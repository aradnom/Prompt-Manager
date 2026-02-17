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

export async function checkPendingMigrations(
  databaseUrl: string,
): Promise<void> {
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl }),
    }),
  });

  try {
    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.join(__dirname, "..", "migrations"),
      }),
    });

    const migrations = await migrator.getMigrations();
    const pending = migrations.filter((m) => !m.executedAt);

    if (pending.length > 0) {
      console.warn(
        `⚠ ${pending.length} pending migration(s): ${pending.map((m) => m.name).join(", ")}`,
      );
      console.warn(`  Run "npm run migrate" to apply.`);
    } else {
      console.debug("✓ Database migrations up to date");
    }
  } finally {
    await db.destroy();
  }
}
