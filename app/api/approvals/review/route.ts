import { NextResponse } from "next/server";
import { reviewDiscountApprovalRequest } from "@/lib/services/quotes";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await readJsonWithLimit(request, 64 * 1024);
    const data = await reviewDiscountApprovalRequest(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
