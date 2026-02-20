import { NextResponse } from "next/server";
import { rollbackImportJob } from "@/lib/services/imports";
import { handleRouteError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await rollbackImportJob(body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

