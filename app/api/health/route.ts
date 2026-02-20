import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { getPdfAdapterHealth } from "@/lib/documents/pdf-adapter";
import { prisma } from "@/lib/db/prisma";
import { checkStorageHealth } from "@/lib/storage/object-storage";

export async function GET() {
  const config = getAppConfig();
  const startedAt = Date.now();
  let db = { ok: false, message: "DB not checked" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true, message: "Database reachable" };
  } catch (error) {
    db = { ok: false, message: error instanceof Error ? error.message : "Database error" };
  }

  const storage = await checkStorageHealth();
  const pdf = getPdfAdapterHealth();
  const ok = db.ok && storage.ok && pdf.ok;

  return NextResponse.json(
    {
      ok,
      deployTarget: config.DEPLOY_TARGET,
      checks: {
        db,
        storage,
        pdf,
      },
      configWarnings: config.configWarnings,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
