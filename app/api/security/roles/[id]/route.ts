import { NextResponse } from "next/server";
import { updateCustomRole } from "@/lib/services/security";
import { handleRouteError } from "@/lib/services/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = await updateCustomRole({
      ...body,
      roleId: id,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

