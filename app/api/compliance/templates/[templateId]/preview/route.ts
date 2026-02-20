import { getAppConfig } from "@/lib/config";
import { generateTemplatePreview } from "@/lib/compliance/admin-service";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";
import { assertRateLimit, requestIp } from "@/lib/services/rate-limit";

type Params = {
  params: Promise<{ templateId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const config = getAppConfig();
    await assertRateLimit({
      scope: "compliance:template:preview",
      key: requestIp(request),
      limit: config.RATE_LIMIT_TEMPLATE_PREVIEW_MAX,
      windowSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
    });
    const { templateId } = await params;
    const body = await readJsonWithLimit(request, config.REQUEST_MAX_BYTES_PREVIEW);
    const data = await generateTemplatePreview(templateId, body);
    const responseBody = Uint8Array.from(data.buffer);
    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": data.contentType,
        "Content-Disposition": `inline; filename="${data.fileName}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
