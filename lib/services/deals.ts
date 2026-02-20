import { AuditAction, DealStage, Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { postDealDelivery } from "@/lib/services/accounting";
import { AppError, requireOrgContext } from "@/lib/services/guard";
import { emitWebhookEvent } from "@/lib/services/integrations";
import { calcMonthlyPayment } from "@/lib/utils";
import {
  dealChecklistSchema,
  dealCreateSchema,
  dealStageTransitionSchema,
  dealUpdateSchema,
  fundingEventSchema,
  tradeInSchema,
} from "@/lib/validations/deals";

type DealFilters = {
  stage?: DealStage;
  query?: string;
  page?: number;
  pageSize?: number;
};

export async function listDeals(filters: DealFilters) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const where = {
    orgId: ctx.orgId,
    ...(filters.stage ? { stage: filters.stage } : {}),
    ...(filters.query
      ? {
          OR: [
            { dealNumber: { contains: filters.query, mode: "insensitive" as const } },
            {
              customer: {
                OR: [
                  { firstName: { contains: filters.query, mode: "insensitive" as const } },
                  { lastName: { contains: filters.query, mode: "insensitive" as const } },
                ],
              },
            },
            {
              vehicle: {
                OR: [
                  { stockNumber: { contains: filters.query, mode: "insensitive" as const } },
                  { vin: { contains: filters.query, mode: "insensitive" as const } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.deal.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        vehicle: true,
        salesperson: true,
        payments: true,
      },
    }),
    prisma.deal.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getDealDetail(dealId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, orgId: ctx.orgId },
    include: {
      customer: true,
      vehicle: true,
      lineItems: true,
      tradeIns: true,
      payments: { orderBy: { postedAt: "desc" } },
      fundingEvents: { orderBy: { eventAt: "desc" } },
      fundingCase: {
        include: {
          stips: { orderBy: { createdAt: "asc" } },
          createdBy: true,
        },
      },
      activities: { orderBy: { createdAt: "desc" } },
      documents: {
        include: {
          template: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!deal) throw new AppError("Deal not found.", 404);
  return deal;
}

async function nextDealNumber(orgId: string) {
  const year = new Date().getFullYear();
  const total = await prisma.deal.count({
    where: {
      orgId,
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      },
    },
  });
  return `D-${year}-${String(total + 1).padStart(4, "0")}`;
}

export async function createDeal(input: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const parsed = dealCreateSchema.parse(input);

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: parsed.vehicleId, orgId: ctx.orgId },
  });
  if (!vehicle) throw new AppError("Vehicle not found.", 404);
  const customer = await prisma.customer.findFirst({
    where: { id: parsed.customerId, orgId: ctx.orgId },
  });
  if (!customer) throw new AppError("Customer not found.", 404);

  const financedAmount = parsed.salePrice + parsed.taxes + parsed.fees - parsed.downPayment - parsed.tradeAllowance + parsed.payoff;
  const monthlyPayment = calcMonthlyPayment({
    principal: financedAmount,
    apr: parsed.apr,
    months: parsed.termMonths,
  });

  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        orgId: ctx.orgId,
        dealNumber: await nextDealNumber(ctx.orgId),
        dealType: parsed.dealType,
        jurisdiction: (parsed.jurisdiction ?? customer.state ?? "TX").toUpperCase(),
        vehicleId: parsed.vehicleId,
        customerId: parsed.customerId,
        salespersonId: parsed.salespersonId ?? ctx.userId,
        stage: DealStage.DRAFT,
        salePrice: parsed.salePrice,
        downPayment: parsed.downPayment,
        apr: parsed.apr,
        termMonths: parsed.termMonths,
        taxes: parsed.taxes,
        fees: parsed.fees,
        tradeAllowance: parsed.tradeAllowance,
        payoff: parsed.payoff,
        financedAmount,
        monthlyPayment,
        checklist: {
          insurance: false,
          odometer: false,
          idVerification: false,
          stips: false,
        },
        notes: parsed.notes,
      },
    });

    await tx.vehicle.update({
      where: { id: parsed.vehicleId },
      data: { status: "ON_HOLD" },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Deal",
      entityId: deal.id,
      action: AuditAction.CREATE,
      after: deal,
    });

    return deal;
  });
}

export async function updateDeal(dealId: string, input: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const parsed = dealUpdateSchema.parse(input);
  const existing = await prisma.deal.findFirst({
    where: { id: dealId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Deal not found.", 404);

  const salePrice = parsed.salePrice ?? Number(existing.salePrice);
  const taxes = parsed.taxes ?? Number(existing.taxes);
  const fees = parsed.fees ?? Number(existing.fees);
  const downPayment = parsed.downPayment ?? Number(existing.downPayment);
  const tradeAllowance = parsed.tradeAllowance ?? Number(existing.tradeAllowance);
  const payoff = parsed.payoff ?? Number(existing.payoff);
  const apr = parsed.apr ?? Number(existing.apr);
  const termMonths = parsed.termMonths ?? existing.termMonths;
  const financedAmount = salePrice + taxes + fees - downPayment - tradeAllowance + payoff;
  const monthlyPayment = calcMonthlyPayment({ principal: financedAmount, apr, months: termMonths });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.deal.update({
      where: { id: dealId },
      data: {
        ...parsed,
        jurisdiction: parsed.jurisdiction?.toUpperCase(),
        financedAmount,
        monthlyPayment,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Deal",
      entityId: dealId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function transitionDealStage(input: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = dealStageTransitionSchema.parse(input);
  const existing = await prisma.deal.findFirst({
    where: { id: parsed.dealId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Deal not found.", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.deal.update({
      where: { id: parsed.dealId },
      data: {
        stage: parsed.stage,
        deliveredAt: parsed.stage === DealStage.DELIVERED ? new Date() : existing.deliveredAt,
      },
    });

    if (parsed.stage === DealStage.DELIVERED) {
      await tx.vehicle.update({
        where: { id: existing.vehicleId },
        data: { status: "DELIVERED", soldAt: new Date() },
      });
    }

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Deal",
      entityId: parsed.dealId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });
    return updated;
  });

  if (parsed.stage === DealStage.DELIVERED) {
    await postDealDelivery({
      orgId: ctx.orgId,
      dealId: parsed.dealId,
      actorId: ctx.userId,
    });
  }

  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "deal.stageChanged",
    entityType: "Deal",
    entityId: parsed.dealId,
    payload: {
      previousStage: existing.stage,
      nextStage: parsed.stage,
    },
  });

  return updated;
}

export async function updateDealChecklist(input: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const parsed = dealChecklistSchema.parse(input);
  const existing = await prisma.deal.findFirst({
    where: { id: parsed.dealId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Deal not found.", 404);
  return prisma.deal.update({
    where: { id: parsed.dealId },
    data: {
      checklist: {
        insurance: parsed.insurance,
        odometer: parsed.odometer,
        idVerification: parsed.idVerification,
        stips: parsed.stips,
      },
    },
  });
}

export async function upsertTradeIn(input: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const parsed = tradeInSchema.parse(input);
  const deal = await prisma.deal.findFirst({
    where: { id: parsed.dealId, orgId: ctx.orgId },
  });
  if (!deal) throw new AppError("Deal not found.", 404);

  const existing = await prisma.tradeIn.findFirst({
    where: { dealId: parsed.dealId, orgId: ctx.orgId },
  });

  if (existing) {
    return prisma.tradeIn.update({
      where: { id: existing.id },
      data: parsed,
    });
  }

  return prisma.tradeIn.create({
    data: {
      orgId: ctx.orgId,
      customerId: deal.customerId,
      ...parsed,
    },
  });
}

export async function createFundingEvent(input: unknown) {
  const ctx = await requireOrgContext(Role.ACCOUNTING);
  const parsed = fundingEventSchema.parse(input);
  const deal = await prisma.deal.findFirst({
    where: { id: parsed.dealId, orgId: ctx.orgId },
  });
  if (!deal) throw new AppError("Deal not found.", 404);

  return prisma.$transaction(async (tx) => {
    const event = await tx.fundingEvent.create({
      data: {
        orgId: ctx.orgId,
        dealId: parsed.dealId,
        status: parsed.status,
        amount: parsed.amount,
        note: parsed.note,
        createdById: ctx.userId,
      },
    });

    await tx.deal.update({
      where: { id: parsed.dealId },
      data: {
        fundingStatus: parsed.status,
      },
    });

    return event;
  });
}

export async function deleteDeal(dealId: string) {
  const ctx = await requireOrgContext(Role.ADMIN);
  const existing = await prisma.deal.findFirst({
    where: { id: dealId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Deal not found.", 404);

  await prisma.$transaction(async (tx) => {
    await tx.deal.delete({
      where: { id: dealId },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Deal",
      entityId: dealId,
      action: AuditAction.DELETE,
      before: existing,
    });
  });
}
