import { NextResponse } from "next/server";
import { createFundingEvent } from "@/lib/services/deals";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createFundingEvent(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
