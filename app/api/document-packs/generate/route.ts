import { NextResponse } from "next/server";
import { generateDocumentPack } from "@/lib/services/document-packs";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await readJsonWithLimit(request, 128 * 1024);
    const data = await generateDocumentPack(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
