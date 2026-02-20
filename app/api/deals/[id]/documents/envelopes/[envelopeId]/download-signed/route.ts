import { NextResponse } from "next/server";
import { resolveSignedEnvelopeDownload } from "@/lib/esign/service";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string; envelopeId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { id, envelopeId } = await params;
    const data = await resolveSignedEnvelopeDownload(id, envelopeId);
    if (data.type === "redirect") {
      return NextResponse.redirect(data.downloadUrl);
    }
    return new NextResponse(data.buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${data.fileName}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
