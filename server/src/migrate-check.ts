import { checkPendingMigrations } from "@server/lib/migration-check";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://promptuser:promptpass@localhost:5432/prompt_manager";

checkPendingMigrations(databaseUrl).catch((error) => {
  console.error("Migration check failed:", error);
  process.exit(1);
});
