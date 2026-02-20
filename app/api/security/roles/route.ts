import { NextResponse } from "next/server";
import { createCustomRole, listSecuritySettings } from "@/lib/services/security";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await listSecuritySettings();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createCustomRole(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

