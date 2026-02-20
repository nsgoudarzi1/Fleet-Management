import { NextResponse } from "next/server";
import { updateChartOfAccount } from "@/lib/services/accounting";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await updateChartOfAccount(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
