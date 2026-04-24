import "dotenv/config";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "@/types/database";
import { hashToken } from "@server/lib/auth";
import { loadConfig } from "@server/config";
import { migrateUserContent } from "@server/lib/migrate-user-content";

/**
 * Usage:
 *   npm run migrate:user-content -- --token XXXX-XXXX-XXXX-XXXX
 *
 * Looks up the user by hashed token, derives the encryption key, and encrypts
 * any plaintext content left over from before encryption was enabled. Safe to
 * run repeatedly — rows already in envelope form are skipped.
 */

function parseArgs(argv: string[]): { token?: string } {
  const out: { token?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--token") {
      out.token = argv[i + 1];
      i++;
    }
  }
  return out;
}

async function run() {
  const { token } = parseArgs(process.argv.slice(2));
  if (!token) {
    console.error("Missing --token <account-token>");
    process.exit(1);
  }

  const config = loadConfig();
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: config.databaseUrl }),
    }),
  });

  try {
    const tokenHash = hashToken(token, config.tokenSecret);
    const user = await db
      .selectFrom("users")
      .select("id")
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();

    if (!user) {
      console.error("No user found for the provided token.");
      process.exit(1);
    }

    console.info(`Re-encrypting content for user ${user.id}...`);
    const report = await migrateUserContent({
      db,
      userId: user.id,
      token,
      encryptionSalt: config.encryptionSalt,
    });

    console.info("Done.");
    for (const [entity, { scanned, encrypted }] of Object.entries(report)) {
      console.info(`  ${entity}: ${encrypted}/${scanned} encrypted`);
    }
  } finally {
    await db.destroy();
  }
}

run().catch((err) => {
  console.error("migrate-user-content failed:", err);
  process.exit(1);
});
