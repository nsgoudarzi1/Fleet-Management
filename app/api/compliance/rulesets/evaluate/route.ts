import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { evaluateComplianceHarness } from "@/lib/compliance/admin-service";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";
import { assertRateLimit, requestIp } from "@/lib/services/rate-limit";

export async function POST(request: Request) {
  try {
    const config = getAppConfig();
    await assertRateLimit({
      scope: "compliance:rules:evaluate",
      key: requestIp(request),
      limit: config.RATE_LIMIT_TEMPLATE_PREVIEW_MAX,
      windowSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
    });
    const body = await readJsonWithLimit(request, config.REQUEST_MAX_BYTES_PREVIEW);
    const data = await evaluateComplianceHarness(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
