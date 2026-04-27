import "dotenv/config";
import { Pool } from "pg";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    "postgresql://promptuser:promptpass@localhost:5432/prompt_manager";

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM information_schema.tables
        WHERE table_schema = 'public'`,
    );
    const tableCount = Number(rows[0]?.count ?? 0);

    if (tableCount > 0) {
      console.error(
        `Refusing to apply schema: target database already contains ${tableCount} table(s) in the public schema.`,
      );
      console.error(
        "This script only runs against an empty database. Drop/recreate the DB (or pick a different DATABASE_URL) and try again.",
      );
      process.exit(1);
    }

    const schemaPath = path.resolve(
      __dirname,
      "../../../local-dev/init/schema.sql",
    );
    const schemaSql = await fs.readFile(schemaPath, "utf8");

    console.info(`Applying ${schemaPath} to ${maskUrl(databaseUrl)}\u2026`);
    await pool.query(schemaSql);
    console.info("Schema applied successfully.");

    await baselineMigrations(pool);
  } finally {
    await pool.end();
  }
}

/**
 * schema.sql IS the baseline — every existing migration has, by definition,
 * already been folded into it. Mark them all as applied so the migrator won't
 * re-run them on the next `npm run migrate`.
 */
async function baselineMigrations(pool: Pool): Promise<void> {
  const migrationsDir = path.resolve(__dirname, "..", "migrations");
  const entries = await fs.readdir(migrationsDir);
  const migrationNames = entries
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .map((f) => f.replace(/\.(ts|js)$/, ""))
    .sort();

  // Match Kysely's internal table shape so the migrator picks them up.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kysely_migration (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      timestamp VARCHAR(255) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kysely_migration_lock (
      id VARCHAR(255) NOT NULL PRIMARY KEY,
      is_locked INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO kysely_migration_lock (id, is_locked)
    VALUES ('migration_lock', 0)
    ON CONFLICT (id) DO NOTHING;
  `);

  const timestamp = new Date().toISOString();
  for (const name of migrationNames) {
    await pool.query(
      `INSERT INTO kysely_migration (name, timestamp)
       VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING`,
      [name, timestamp],
    );
  }

  console.info(
    `Baselined ${migrationNames.length} migration(s) as already applied.`,
  );
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return url;
  }
}

run().catch((err) => {
  console.error("init-schema failed:", err);
  process.exit(1);
});
