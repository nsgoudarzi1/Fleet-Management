import { NextResponse } from "next/server";
import { completeUpfitMilestone } from "@/lib/services/upfits";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await readJsonWithLimit(request, 64 * 1024);
    const data = await completeUpfitMilestone(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
