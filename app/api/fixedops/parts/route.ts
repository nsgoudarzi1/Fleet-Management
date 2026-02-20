import { NextResponse } from "next/server";
import { createPart, listParts } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listParts({
      query: searchParams.get("q") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 25),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createPart(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
