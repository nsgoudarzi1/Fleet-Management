import { NextResponse } from "next/server";
import { getDealDocumentsWorkspace } from "@/lib/documents/service";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getDealDocumentsWorkspace(id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
