import { NextResponse } from "next/server";
import { receiveParts } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await receiveParts(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
