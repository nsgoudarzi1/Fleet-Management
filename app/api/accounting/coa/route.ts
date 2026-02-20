import { NextResponse } from "next/server";
import { createChartOfAccount, listChartOfAccounts } from "@/lib/services/accounting";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await listChartOfAccounts();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createChartOfAccount(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
