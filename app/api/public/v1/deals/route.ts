import { NextResponse } from "next/server";
import { ApiKeyScope } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiKeyScope } from "@/lib/services/integrations";
import { handleRouteError } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const apiCtx = await requireApiKeyScope(request, ApiKeyScope.DEALS_READ);
    const { searchParams } = new URL(request.url);
    const take = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? 25)));
    const data = await prisma.deal.findMany({
      where: { orgId: apiCtx.orgId },
      include: { customer: true, vehicle: true },
      orderBy: { createdAt: "desc" },
      take,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function nextDealNumber(orgId: string) {
  const year = new Date().getUTCFullYear();
  const count = await prisma.deal.count({
    where: {
      orgId,
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      },
    },
  });
  return `D-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  try {
    const apiCtx = await requireApiKeyScope(request, ApiKeyScope.DEALS_WRITE);
    const body = (await request.json()) as Record<string, unknown>;
    const created = await prisma.deal.create({
      data: {
        orgId: apiCtx.orgId,
        dealNumber: await nextDealNumber(apiCtx.orgId),
        vehicleId: String(body.vehicleId ?? ""),
        customerId: String(body.customerId ?? ""),
        dealType: (String(body.dealType ?? "CASH").toUpperCase() as "CASH" | "FINANCE" | "LEASE"),
        jurisdiction: typeof body.jurisdiction === "string" ? body.jurisdiction.toUpperCase() : "TX",
        salePrice: Number(body.salePrice ?? 0),
        downPayment: Number(body.downPayment ?? 0),
        taxes: Number(body.taxes ?? 0),
        fees: Number(body.fees ?? 0),
        financedAmount: Number(body.financedAmount ?? 0),
        monthlyPayment: Number(body.monthlyPayment ?? 0),
        apr: Number(body.apr ?? 0),
        termMonths: Number(body.termMonths ?? 60),
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
