import { NextResponse } from "next/server";
import { voidDealEnvelope } from "@/lib/esign/service";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string; envelopeId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id, envelopeId } = await params;
    const body = (await request.json().catch(() => ({}))) as unknown;
    const data = await voidDealEnvelope(id, envelopeId, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
