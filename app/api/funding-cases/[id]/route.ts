import { NextResponse } from "next/server";
import { updateFundingCase } from "@/lib/services/funding";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await updateFundingCase({ ...body, fundingCaseId: id });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
