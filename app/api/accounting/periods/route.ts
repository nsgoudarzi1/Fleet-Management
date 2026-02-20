import { NextResponse } from "next/server";
import { listAccountingPeriods } from "@/lib/services/accounting";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await listAccountingPeriods();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
