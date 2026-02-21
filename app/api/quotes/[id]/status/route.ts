import { NextResponse } from "next/server";
import { updateQuoteStatus } from "@/lib/services/quotes";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonWithLimit(request, 32 * 1024);
    const data = await updateQuoteStatus(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
