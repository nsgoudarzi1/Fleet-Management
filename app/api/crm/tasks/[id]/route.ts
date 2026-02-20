import { NextResponse } from "next/server";
import { updateCrmTask } from "@/lib/services/crm";
import { handleRouteError } from "@/lib/services/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = await updateCrmTask({
      ...body,
      taskId: id,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

