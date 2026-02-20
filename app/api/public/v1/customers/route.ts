import { NextResponse } from "next/server";
import { ApiKeyScope } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiKeyScope } from "@/lib/services/integrations";
import { handleRouteError } from "@/lib/services/http";

export async function GET(request: Request) {
  try {
    const apiCtx = await requireApiKeyScope(request, ApiKeyScope.CUSTOMERS_READ);
    const { searchParams } = new URL(request.url);
    const take = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? 25)));
    const data = await prisma.customer.findMany({
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
    const apiCtx = await requireApiKeyScope(request, ApiKeyScope.CUSTOMERS_WRITE);
    const body = (await request.json()) as Record<string, unknown>;
    const created = await prisma.customer.create({
      data: {
        orgId: apiCtx.orgId,
        firstName: String(body.firstName ?? ""),
        lastName: String(body.lastName ?? ""),
        email: typeof body.email === "string" ? body.email : undefined,
        phone: typeof body.phone === "string" ? body.phone : undefined,
        address1: typeof body.address1 === "string" ? body.address1 : undefined,
        city: typeof body.city === "string" ? body.city : undefined,
        state: typeof body.state === "string" ? body.state : undefined,
        postalCode: typeof body.postalCode === "string" ? body.postalCode : undefined,
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
