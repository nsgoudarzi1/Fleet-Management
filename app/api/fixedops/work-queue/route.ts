import { NextResponse } from "next/server";
import { fixedOpsWorkQueue } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await fixedOpsWorkQueue();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
