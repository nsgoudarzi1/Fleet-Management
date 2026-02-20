import { NextResponse } from "next/server";
import { createRepairOrder, listRepairOrders } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listRepairOrders({
      query: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 25),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createRepairOrder(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
