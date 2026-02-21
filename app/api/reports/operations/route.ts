import { NextResponse } from "next/server";
import { getOperationsReports } from "@/lib/services/reports";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await getOperationsReports();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
