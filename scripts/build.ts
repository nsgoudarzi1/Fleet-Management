import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

function run(command: string) {
  execSync(command, {
    stdio: "inherit",
    env: process.env,
  });
}

async function verifyRuntimeSchema() {
  const prisma = new PrismaClient();
  try {
    const [result] = await prisma.$queryRaw<Array<{ userTable: string | null; rateTable: string | null }>>`
      SELECT
        to_regclass('public."User"') AS "userTable",
        to_regclass('public."ApiRateLimit"') AS "rateTable"
    `;

    if (!result?.userTable || !result?.rateTable) {
      console.error("[build] Runtime schema check failed.");
      console.error(`[build] public.User found: ${Boolean(result?.userTable)}`);
      console.error(`[build] public.ApiRateLimit found: ${Boolean(result?.rateTable)}`);
      console.error("[build] DATABASE_URL may be pointing to a different database than DIRECT_URL.");
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const runMigrations = process.env.RUN_DB_MIGRATIONS === "true";

async function main() {
  if (runMigrations) {
    if (!process.env.DATABASE_URL) {
      console.error("[build] DATABASE_URL is required to run prisma migrate deploy.");
      process.exit(1);
    }

    if (!process.env.DIRECT_URL) {
      process.env.DIRECT_URL = process.env.DATABASE_URL;
      console.warn("[build] DIRECT_URL is missing; using DATABASE_URL as fallback for migrations.");
    }

    console.log("[build] Running prisma migrate deploy...");
    try {
      run("npx prisma migrate deploy");
    } catch (error) {
      console.error("[build] prisma migrate deploy failed.");
      console.error("[build] Verify DATABASE_URL/DIRECT_URL point to the same reachable Postgres database.");
      throw error;
    }

    console.log("[build] Verifying runtime schema on DATABASE_URL...");
    await verifyRuntimeSchema();
  } else {
    console.log("[build] Skipping prisma migrate deploy (set RUN_DB_MIGRATIONS=true to enable).");
  }

  console.log("[build] Running next build...");
  run("npx next build");
}

main().catch((error) => {
  console.error("[build] Build script failed.", error);
  process.exit(1);
});
