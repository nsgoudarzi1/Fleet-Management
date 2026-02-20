import { NextResponse } from "next/server";
import { closeAccountingPeriod } from "@/lib/services/accounting";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await closeAccountingPeriod(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
