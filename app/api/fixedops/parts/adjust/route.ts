import { NextResponse } from "next/server";
import { adjustPartInventory } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await adjustPartInventory(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
