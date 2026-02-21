import { NextResponse } from "next/server";
import { acceptQuoteByShareToken } from "@/lib/services/quotes";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ token: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const { token } = await params;
    const data = await acceptQuoteByShareToken(token);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
