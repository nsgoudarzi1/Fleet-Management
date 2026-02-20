import { NextResponse } from "next/server";
import { createWebhookEndpoint, listWebhookEndpoints } from "@/lib/services/integrations";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await listWebhookEndpoints();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createWebhookEndpoint(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
