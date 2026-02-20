import { NextResponse } from "next/server";
import { createCrmTask, listCrmTasks } from "@/lib/services/crm";
import { handleRouteError } from "@/lib/services/http";

export async function GET() {
  try {
    const data = await listCrmTasks();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createCrmTask(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

