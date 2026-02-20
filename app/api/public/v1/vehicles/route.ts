import { NextResponse } from "next/server";
import { ApiKeyScope } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiKeyScope } from "@/lib/services/integrations";
import { handleRouteError } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const apiCtx = await requireApiKeyScope(request, ApiKeyScope.VEHICLES_READ);
    const { searchParams } = new URL(request.url);
    const take = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? 25)));
    const data = await prisma.vehicle.findMany({
      where: { orgId: apiCtx.orgId },
      orderBy: { createdAt: "desc" },
      take,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const apiCtx = await requireApiKeyScope(request, ApiKeyScope.VEHICLES_WRITE);
    const body = (await request.json()) as Record<string, unknown>;
    const created = await prisma.vehicle.create({
      data: {
        orgId: apiCtx.orgId,
        vin: String(body.vin ?? ""),
        stockNumber: String(body.stockNumber ?? ""),
        year: Number(body.year ?? 0),
        make: String(body.make ?? ""),
        model: String(body.model ?? ""),
        trim: typeof body.trim === "string" ? body.trim : undefined,
        mileage: Number(body.mileage ?? 0),
        listPrice: Number(body.listPrice ?? 0),
        minPrice: typeof body.minPrice === "number" ? body.minPrice : undefined,
        status: "ACQUIRED",
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
