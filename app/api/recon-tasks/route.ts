import { NextResponse } from "next/server";
import { createReconTask } from "@/lib/services/inventory";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createReconTask(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
