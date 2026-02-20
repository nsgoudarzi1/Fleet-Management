import { NextResponse } from "next/server";
import { getRepairOrderDetail } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getRepairOrderDetail(id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
