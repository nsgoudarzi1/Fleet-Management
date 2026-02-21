import { NextResponse } from "next/server";
import { createQuoteShareLink } from "@/lib/services/quotes";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonWithLimit(request, 32 * 1024);
    const data = await createQuoteShareLink(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
