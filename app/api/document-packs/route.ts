import { NextResponse } from "next/server";
import { createDocumentPackTemplate, listDocumentPackTemplates } from "@/lib/services/document-packs";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listDocumentPackTemplates({
      state: searchParams.get("state") ?? undefined,
      saleType: searchParams.get("saleType") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonWithLimit(request, 512 * 1024);
    const data = await createDocumentPackTemplate(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
