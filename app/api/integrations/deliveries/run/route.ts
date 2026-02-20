import { NextResponse } from "next/server";
import { runWebhookWorkerForOrg } from "@/lib/services/integrations";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Number(body.limit ?? 20);
    const data = await runWebhookWorkerForOrg(limit);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
