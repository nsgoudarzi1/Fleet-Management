import { NextResponse } from "next/server";
import { bulkUpdateVehicleStatus } from "@/lib/services/inventory";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const count = await bulkUpdateVehicleStatus(body);
    return NextResponse.json({ count });
  } catch (error) {
    return handleRouteError(error);
  }
}
