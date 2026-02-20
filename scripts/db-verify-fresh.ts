import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

function fail(message: string): never {
  throw new Error(message);
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    fail(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function validateMigrationLayout() {
  const migrationsRoot = join(process.cwd(), "prisma", "migrations");
  if (!existsSync(migrationsRoot)) {
    fail("Missing prisma/migrations directory.");
  }

  const entries = readdirSync(migrationsRoot, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  for (const folder of folders) {
    if (!/^\d{14}_[a-z0-9_]+$/.test(folder)) {
      fail(`Invalid migration folder name: ${folder}`);
    }
    const folderPath = join(migrationsRoot, folder);
    const files = readdirSync(folderPath, { withFileTypes: true }).filter((entry) => entry.isFile());
    const sqlFiles = files.filter((file) => file.name.endsWith(".sql"));
    if (sqlFiles.length !== 1 || sqlFiles[0]?.name !== "migration.sql") {
      fail(`Migration folder ${folder} must contain exactly one migration.sql.`);
    }
  }

  const rootSql = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"));
  if (rootSql.length > 0) {
    fail(`Found stray SQL files in prisma/migrations root: ${rootSql.map((f) => f.name).join(", ")}`);
  }

  const allSqlInPrisma: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const fullPath = join(dir, name);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (name.endsWith(".sql")) {
        allSqlInPrisma.push(relative(process.cwd(), fullPath).replaceAll("\\", "/"));
      }
    }
  };

  walk(join(process.cwd(), "prisma"));

  const allowed = new Set(folders.map((folder) => `prisma/migrations/${folder}/migration.sql`));
  const disallowed = allSqlInPrisma.filter((path) => !allowed.has(path));
  if (disallowed.length > 0) {
    fail(`Found SQL files outside migration folders: ${disallowed.join(", ")}`);
  }
}

function withDatabase(baseUrl: URL, databaseName: string) {
  const next = new URL(baseUrl.toString());
  next.pathname = `/${databaseName}`;
  return next;
}

function safeDbName(name: string) {
  const normalized = name.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(normalized)) {
    fail(`Unable to derive safe database name from: ${name}`);
  }
  return normalized.slice(0, 60);
}

async function dropDatabase(admin: PrismaClient, dbName: string) {
  await admin.$executeRawUnsafe(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid()`,
  );
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
}

async function main() {
  validateMigrationLayout();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is required.");

  const parsed = new URL(databaseUrl);
  const sourceDb = parsed.pathname.replace(/^\//, "");
  if (!sourceDb) fail("DATABASE_URL must include a database name.");

  const verifyDb = safeDbName(`${sourceDb}_verify_${Date.now().toString(36)}`);
  const adminDb = process.env.DB_VERIFY_ADMIN_DB ?? "postgres";
  const adminUrl = withDatabase(parsed, adminDb).toString();
  const verifyUrl = withDatabase(parsed, verifyDb).toString();

  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  let verifyClient: PrismaClient | null = null;

  try {
    console.log(`[db:verify-fresh] Using temp database: ${verifyDb}`);
    await dropDatabase(admin, verifyDb);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${verifyDb}"`);

    const env = {
      ...process.env,
      DATABASE_URL: verifyUrl,
      DIRECT_URL: verifyUrl,
    };

    runCommand("npx", ["prisma", "migrate", "deploy"], env);
    runCommand("npx", ["prisma", "db", "seed"], env);

    verifyClient = new PrismaClient({ datasources: { db: { url: verifyUrl } } });
    const [orgCount, userCount, vehicleCount] = await Promise.all([
      verifyClient.organization.count(),
      verifyClient.user.count(),
      verifyClient.vehicle.count(),
    ]);

    if (orgCount < 1 || userCount < 1 || vehicleCount < 1) {
      fail(`Sanity checks failed (orgs=${orgCount}, users=${userCount}, vehicles=${vehicleCount}).`);
    }

    console.log("[db:verify-fresh] PASS");
    console.log(`[db:verify-fresh] sanity orgs=${orgCount} users=${userCount} vehicles=${vehicleCount}`);
  } finally {
    if (verifyClient) {
      await verifyClient.$disconnect();
    }
    await dropDatabase(admin, verifyDb);
    await admin.$disconnect();
  }
}

main().catch((error) => {
  console.error("[db:verify-fresh] FAIL", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
