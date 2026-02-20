import { NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/services/integrations";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await listApiKeys();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createApiKey(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
