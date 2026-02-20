import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { getComplianceRuleSet, patchComplianceRuleSet } from "@/lib/compliance/admin-service";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getComplianceRuleSet(id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const config = getAppConfig();
    const { id } = await params;
    const body = await readJsonWithLimit(request, config.REQUEST_MAX_BYTES_PREVIEW);
    const data = await patchComplianceRuleSet(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
