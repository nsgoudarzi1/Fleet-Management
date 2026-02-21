import { NextResponse } from "next/server";
import { createFleetAccount, listFleetAccounts } from "@/lib/services/fleet-accounts";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listFleetAccounts({
      q: searchParams.get("q") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonWithLimit(request, 256 * 1024);
    const data = await createFleetAccount(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
