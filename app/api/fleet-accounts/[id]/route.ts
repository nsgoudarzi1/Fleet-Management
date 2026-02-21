import { NextResponse } from "next/server";
import { getFleetAccountDetail, updateFleetAccount } from "@/lib/services/fleet-accounts";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getFleetAccountDetail(id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonWithLimit(request, 256 * 1024);
    const data = await updateFleetAccount(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
