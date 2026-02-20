import { NextResponse } from "next/server";
import { redeliverWebhookEvent } from "@/lib/services/integrations";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const webhookEventId = String(body.webhookEventId ?? "");
    const data = await redeliverWebhookEvent({ webhookEventId });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
