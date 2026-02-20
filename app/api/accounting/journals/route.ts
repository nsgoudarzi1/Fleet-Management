import { NextResponse } from "next/server";
import { listJournalEntries } from "@/lib/services/accounting";
import { handleRouteError } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listJournalEntries({
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 25),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
