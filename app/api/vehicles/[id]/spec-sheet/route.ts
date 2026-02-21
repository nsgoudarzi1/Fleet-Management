import { generateVehicleSpecSheet } from "@/lib/services/inventory";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const data = await generateVehicleSpecSheet(id, {
      version: (searchParams.get("version") ?? undefined) as never,
      dealId: searchParams.get("dealId") ?? undefined,
    });
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
