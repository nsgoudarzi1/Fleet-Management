import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { AppError } from "@/lib/services/guard";
import { deliverPendingWebhooks, runWebhookWorkerForOrg } from "@/lib/services/integrations";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const config = getAppConfig();
    const body = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(100, Number(body.limit ?? 20)));

    const headerSecret = request.headers.get("x-worker-secret");
    const bearer = request.headers.get("authorization");
    const bearerSecret = bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : null;
    const suppliedSecret = headerSecret ?? bearerSecret;

    if (suppliedSecret) {
      if (!config.WORKER_SECRET || suppliedSecret !== config.WORKER_SECRET) {
        throw new AppError("Invalid worker secret.", 401);
      }
      const data = await deliverPendingWebhooks(limit);
      return NextResponse.json({ data, mode: "secret" });
    }

    const data = await runWebhookWorkerForOrg(limit);
    return NextResponse.json({ data, mode: "session" });
  } catch (error) {
    return handleRouteError(error);
  }
}
