import { NextResponse } from "next/server";
import { updateMembershipRole } from "@/lib/services/security";
import { handleRouteError } from "@/lib/services/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = await updateMembershipRole({
      ...body,
      membershipId: id,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

