import { NextResponse } from "next/server";
import { transitionRepairOrderStatus } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await transitionRepairOrderStatus(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
