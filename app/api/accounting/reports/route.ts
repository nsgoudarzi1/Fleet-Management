import { NextResponse } from "next/server";
import { accountingDeepReports } from "@/lib/services/accounting";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await accountingDeepReports();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
