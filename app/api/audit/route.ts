import { NextResponse } from "next/server";
import { listAuditEvents } from "@/lib/services/security";
import { handleRouteError } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listAuditEvents({
      entityType: searchParams.get("entityType") ?? undefined,
      actorId: searchParams.get("actorId") ?? undefined,
      action: searchParams.get("action") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

