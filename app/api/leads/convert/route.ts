import { NextResponse } from "next/server";
import { convertLeadToCustomer } from "@/lib/services/crm";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await convertLeadToCustomer(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
