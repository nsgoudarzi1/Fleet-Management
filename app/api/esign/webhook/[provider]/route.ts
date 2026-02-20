import { NextResponse } from "next/server";
import { processESignWebhook } from "@/lib/esign/service";
import { AppError } from "@/lib/services/guard";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ provider: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { provider } = await params;
    const data = await processESignWebhook(provider, request);
    if (provider === "dropboxsign") {
      return new NextResponse("Hello API Event Received", { status: 200 });
    }
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AppError && error.status === 401) {
      return new NextResponse("Invalid signature", { status: 401 });
    }
    return handleRouteError(error);
  }
}
