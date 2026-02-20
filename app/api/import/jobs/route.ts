import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { readJsonWithLimit, handleRouteError } from "@/lib/services/http";
import { listImportJobs, runImportJob } from "@/lib/services/imports";

export async function GET() {
  try {
    const data = await listImportJobs();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const config = getAppConfig();
    const body = await readJsonWithLimit(request, config.REQUEST_MAX_BYTES_TEMPLATES * 2);
    const data = await runImportJob(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

