import { NextResponse } from "next/server";
import { createActivity } from "@/lib/services/crm";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createActivity(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
