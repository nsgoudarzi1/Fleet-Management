import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { getComplianceTemplate, patchComplianceTemplate, softDeleteComplianceTemplate } from "@/lib/compliance/admin-service";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

type Params = {
  params: Promise<{ templateId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { templateId } = await params;
    const data = await getComplianceTemplate(templateId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const config = getAppConfig();
    const { templateId } = await params;
    const body = await readJsonWithLimit(request, config.REQUEST_MAX_BYTES_PREVIEW);
    const data = await patchComplianceTemplate(templateId, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { templateId } = await params;
    const data = await softDeleteComplianceTemplate(templateId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
