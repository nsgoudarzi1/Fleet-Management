import { NextResponse } from "next/server";
import { getVehicleSpec, updateVehicleSpec } from "@/lib/services/inventory";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const data = await getVehicleSpec(id, {
      version: (searchParams.get("version") ?? undefined) as never,
      dealId: searchParams.get("dealId") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonWithLimit(request, 128 * 1024);
    const data = await updateVehicleSpec(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
