import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { createComplianceRuleSetVersion, listComplianceRuleSets } from "@/lib/compliance/admin-service";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listComplianceRuleSets({
      jurisdiction: searchParams.get("jurisdiction") ?? undefined,
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
    const body = await readJsonWithLimit(request, config.REQUEST_MAX_BYTES_PREVIEW);
    const data = await createComplianceRuleSetVersion(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
