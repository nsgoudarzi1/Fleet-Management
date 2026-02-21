import { NextResponse } from "next/server";
import { createUpfitJob, listUpfitJobs } from "@/lib/services/upfits";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listUpfitJobs({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonWithLimit(request, 256 * 1024);
    const data = await createUpfitJob(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
