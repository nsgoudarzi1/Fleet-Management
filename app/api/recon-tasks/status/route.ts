import { NextResponse } from "next/server";
import { setReconTaskStatus } from "@/lib/services/inventory";
import { handleRouteError } from "@/lib/services/http";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const data = await setReconTaskStatus(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
