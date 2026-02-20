import { NextResponse } from "next/server";
import { listPartVendors } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await listPartVendors();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
