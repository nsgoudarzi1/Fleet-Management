import { NextResponse } from "next/server";
import { addAttachment, deleteAttachment, listAttachments } from "@/lib/services/inventory";
import { handleRouteError, readJsonWithLimit } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const data = await listAttachments(id, {
      q: searchParams.get("q") ?? undefined,
      tag: searchParams.get("tag") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonWithLimit(request, 30 * 1024 * 1024);
    const data = await addAttachment(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonWithLimit(request, 64 * 1024);
    await deleteAttachment(id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
