import { NextResponse } from "next/server";
import { listTechnicians } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await listTechnicians();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
