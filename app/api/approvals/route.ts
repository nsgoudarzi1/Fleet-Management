import { NextResponse } from "next/server";
import { createDiscountApprovalRequest, listApprovalRequests } from "@/lib/services/quotes";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await listApprovalRequests();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonWithLimit(request, 64 * 1024);
    const data = await createDiscountApprovalRequest(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
