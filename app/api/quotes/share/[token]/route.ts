import { NextResponse } from "next/server";
import { getQuoteByShareToken } from "@/lib/services/quotes";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ token: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { token } = await params;
    const data = await getQuoteByShareToken(token);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
