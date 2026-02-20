import { NextResponse } from "next/server";
import { universalSearch } from "@/lib/services/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const data = await universalSearch(q);
  return NextResponse.json({ data });
}
