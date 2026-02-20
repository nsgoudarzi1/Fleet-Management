import { NextResponse } from "next/server";
import { updateRepairOrderLineDecision } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await updateRepairOrderLineDecision(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
