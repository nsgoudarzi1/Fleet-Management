import { NextResponse } from "next/server";
import { createDeal } from "@/lib/services/deals";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createDeal(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
