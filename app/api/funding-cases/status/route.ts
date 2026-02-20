import { NextResponse } from "next/server";
import { transitionFundingCaseStatus } from "@/lib/services/funding";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await transitionFundingCaseStatus(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
