import { NextResponse } from "next/server";
import { addReconLineItem } from "@/lib/services/inventory";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await addReconLineItem(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
