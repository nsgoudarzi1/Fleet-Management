import { NextResponse } from "next/server";
import { createFundingCase, listFundingQueue } from "@/lib/services/funding";
import { handleRouteError } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listFundingQueue({
      status: searchParams.get("status") ?? undefined,
      query: searchParams.get("q") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createFundingCase(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
