import { NextResponse } from "next/server";
import { resolveDealDocumentDownload } from "@/lib/documents/service";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string; documentId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { documentId, id } = await params;
    const data = await resolveDealDocumentDownload(documentId, id);
    if (data.type === "redirect") {
      return NextResponse.redirect(data.downloadUrl);
    }
    return new NextResponse(data.buffer, {
      status: 200,
      headers: {
        "Content-Type": data.contentType,
        "Content-Disposition": `inline; filename="${data.fileName}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
