import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/services/integrations";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await revokeApiKey(id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
