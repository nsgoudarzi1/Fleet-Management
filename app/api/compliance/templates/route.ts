import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { createComplianceTemplate, listComplianceTemplates } from "@/lib/compliance/admin-service";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";
import { assertRateLimit, requestIp } from "@/lib/services/rate-limit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listComplianceTemplates({
      jurisdiction: searchParams.get("jurisdiction") ?? undefined,
      docType: searchParams.get("docType") ?? undefined,
      dealType: searchParams.get("dealType") ?? undefined,
      activeOn: searchParams.get("activeOn") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const config = getAppConfig();
    await assertRateLimit({
      scope: "compliance:template:create",
      key: requestIp(request),
      limit: config.RATE_LIMIT_TEMPLATE_PREVIEW_MAX,
      windowSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
    });
    const body = await readJsonWithLimit(request, config.REQUEST_MAX_BYTES_TEMPLATES);
    const data = await createComplianceTemplate(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
