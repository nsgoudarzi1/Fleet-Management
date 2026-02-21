import { NextResponse } from "next/server";
import { createQuote, listQuotes } from "@/lib/services/quotes";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listQuotes({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
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
    const data = await createQuote(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
