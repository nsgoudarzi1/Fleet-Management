import { NextResponse } from "next/server";
import { createOrUpdateSavedView, deleteSavedView, listSavedViews } from "@/lib/services/saved-views";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityKey = searchParams.get("entityKey");
  if (!entityKey) {
    return NextResponse.json({ error: "entityKey is required" }, { status: 400 });
  }
  const data = await listSavedViews(entityKey);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const data = await createOrUpdateSavedView(body);
  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await deleteSavedView(id);
  return NextResponse.json({ ok: true });
}
