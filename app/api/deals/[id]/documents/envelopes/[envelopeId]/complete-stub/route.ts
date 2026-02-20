import { NextResponse } from "next/server";
import { completeStubEnvelope } from "@/lib/esign/service";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string; envelopeId: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const { id, envelopeId } = await params;
    const data = await completeStubEnvelope(id, envelopeId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
