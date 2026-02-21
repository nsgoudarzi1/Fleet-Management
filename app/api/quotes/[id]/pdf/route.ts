import { generateQuotePdf } from "@/lib/services/quotes";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await generateQuotePdf(id);
    return new Response(Uint8Array.from(data.buffer), {
      headers: {
        "Content-Type": data.contentType,
        "Content-Disposition": `attachment; filename="${data.fileName}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
