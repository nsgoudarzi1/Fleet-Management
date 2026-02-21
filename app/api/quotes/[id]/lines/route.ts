import { NextResponse } from "next/server";
import { addQuoteLine, removeQuoteLine } from "@/lib/services/quotes";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonWithLimit(request, 128 * 1024);
    const data = await addQuoteLine(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonWithLimit(request, 64 * 1024);
    const data = await removeQuoteLine(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
