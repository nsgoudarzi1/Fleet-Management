import { NextResponse } from "next/server";
import { ApiKeyScope } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiKeyScope } from "@/lib/services/integrations";
import { handleRouteError } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const apiCtx = await requireApiKeyScope(request, ApiKeyScope.REPAIR_ORDERS_READ);
    const { searchParams } = new URL(request.url);
    const take = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? 25)));
    const data = await prisma.repairOrder.findMany({
      where: { orgId: apiCtx.orgId },
      include: { customer: true, vehicle: true, lines: true },
      orderBy: { createdAt: "desc" },
      take,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function nextRoNumber(orgId: string) {
  const year = new Date().getUTCFullYear();
  const count = await prisma.repairOrder.count({
    where: {
      orgId,
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      },
    },
  });
  return `RO-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  try {
    const apiCtx = await requireApiKeyScope(request, ApiKeyScope.REPAIR_ORDERS_WRITE);
    const body = (await request.json()) as Record<string, unknown>;
    const created = await prisma.repairOrder.create({
      data: {
        orgId: apiCtx.orgId,
        roNumber: await nextRoNumber(apiCtx.orgId),
        customerId: String(body.customerId ?? ""),
        vehicleId: String(body.vehicleId ?? ""),
        customerNotes: typeof body.customerNotes === "string" ? body.customerNotes : undefined,
        internalNotes: typeof body.internalNotes === "string" ? body.internalNotes : undefined,
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
