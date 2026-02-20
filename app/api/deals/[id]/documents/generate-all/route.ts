import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { generateAllRequiredDealDocuments } from "@/lib/documents/service";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";
import { assertRateLimit, requestIp } from "@/lib/services/rate-limit";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const config = getAppConfig();
    await assertRateLimit({
      scope: "documents:generate-all",
      key: requestIp(request),
      limit: config.RATE_LIMIT_DOC_GEN_MAX,
      windowSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
    });
    const { id } = await params;
    const body = await readJsonWithLimit<{
      regenerate?: boolean;
      regenerateReason?: string;
    }>(request, 64 * 1024);
    const data = await generateAllRequiredDealDocuments({
      dealId: id,
      regenerate: body.regenerate,
      regenerateReason: body.regenerateReason,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
