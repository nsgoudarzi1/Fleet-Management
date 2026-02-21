import { AuditAction, Role, UpfitJobStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext } from "@/lib/services/guard";
import { emitWebhookEvent } from "@/lib/services/integrations";
import { calculateQuoteTotals } from "@/lib/services/quote-math";
import { calculateUpfitRollupAmount } from "@/lib/services/upfit-math";
import {
  upfitJobCreateSchema,
  upfitListSchema,
  upfitMilestoneCompleteSchema,
  upfitMilestoneCreateSchema,
  upfitRollupSchema,
  upfitStatusUpdateSchema,
} from "@/lib/validations/upfits";

async function recomputeQuoteFromDb(tx: Prisma.TransactionClient, orgId: string, quoteId: string) {
  const [org, lines] = await Promise.all([
    tx.organization.findUnique({
      where: { id: orgId },
      select: { taxRate: true },
    }),
    tx.quoteLine.findMany({
      where: { orgId, quoteId },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const taxRate = Number(org?.taxRate ?? 0);
  for (const line of lines) {
    const totals = calculateQuoteTotals(
      [
        {
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          taxable: line.taxable,
          unitCost: Number(line.unitCost),
        },
      ],
      taxRate,
    );
    await tx.quoteLine.update({
      where: { id: line.id },
      data: {
        lineSubtotal: totals.subtotal,
        lineTax: totals.taxTotal,
        lineTotal: totals.total,
        lineCost: totals.costTotal,
        lineGross: totals.grossTotal,
      },
    });
  }
  const totals = calculateQuoteTotals(
    lines.map((line) => ({
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      taxable: line.taxable,
      unitCost: Number(line.unitCost),
    })),
    taxRate,
  );
  return tx.quote.update({
    where: { id: quoteId },
    data: totals,
  });
}

export async function listUpfitJobs(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const input = upfitListSchema.parse(rawInput ?? {});
  return prisma.upfitJob.findMany({
    where: {
      orgId: ctx.orgId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.q
        ? {
            OR: [
              { internalNotes: { contains: input.q, mode: "insensitive" as const } },
              { customerNotes: { contains: input.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: {
      vehicle: true,
      deal: true,
      quote: true,
      vendor: true,
      milestones: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function createUpfitJob(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const input = upfitJobCreateSchema.parse(rawInput);

  if (!input.vehicleId && !input.dealId && !input.quoteId) {
    throw new AppError("Upfit job must be linked to a vehicle, deal, or quote.", 400);
  }

  const [vehicle, deal, quote, vendor] = await Promise.all([
    input.vehicleId
      ? prisma.vehicle.findFirst({ where: { id: input.vehicleId, orgId: ctx.orgId }, select: { id: true } })
      : Promise.resolve(null),
    input.dealId
      ? prisma.deal.findFirst({ where: { id: input.dealId, orgId: ctx.orgId }, select: { id: true } })
      : Promise.resolve(null),
    input.quoteId
      ? prisma.quote.findFirst({ where: { id: input.quoteId, orgId: ctx.orgId }, select: { id: true } })
      : Promise.resolve(null),
    input.vendorId
      ? prisma.vendor.findFirst({ where: { id: input.vendorId, orgId: ctx.orgId }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  if (input.vehicleId && !vehicle) throw new AppError("Vehicle not found.", 404);
  if (input.dealId && !deal) throw new AppError("Deal not found.", 404);
  if (input.quoteId && !quote) throw new AppError("Quote not found.", 404);
  if (input.vendorId && !vendor) throw new AppError("Vendor not found.", 404);

  const created = await prisma.$transaction(async (tx) => {
    const job = await tx.upfitJob.create({
      data: {
        orgId: ctx.orgId,
        vehicleId: input.vehicleId,
        dealId: input.dealId,
        quoteId: input.quoteId,
        vendorId: input.vendorId,
        status: input.status,
        eta: input.eta ? new Date(input.eta) : undefined,
        internalNotes: input.internalNotes,
        customerNotes: input.customerNotes,
        costEstimate: input.costEstimate,
        actualCost: input.actualCost,
        billableToCustomer: input.billableToCustomer,
        includeActualCosts: input.includeActualCosts,
        createdById: ctx.userId,
        milestones: {
          create: input.milestones.map((milestone) => ({
            orgId: ctx.orgId,
            name: milestone.name,
            dueAt: milestone.dueAt ? new Date(milestone.dueAt) : undefined,
          })),
        },
      },
      include: {
        milestones: true,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "UpfitJob",
      entityId: job.id,
      action: AuditAction.CREATE,
      after: job,
    });
    return job;
  });

  await computeCostRollups({ jobId: created.id });
  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "upfit.created",
    entityType: "UpfitJob",
    entityId: created.id,
    payload: {
      status: created.status,
      dealId: created.dealId,
      quoteId: created.quoteId,
      vehicleId: created.vehicleId,
    },
  });

  return created;
}

export async function updateUpfitStatus(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const input = upfitStatusUpdateSchema.parse(rawInput);
  const existing = await prisma.upfitJob.findFirst({
    where: { id: input.jobId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Upfit job not found.", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const job = await tx.upfitJob.update({
      where: { id: input.jobId },
      data: { status: input.status },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "UpfitJob",
      entityId: existing.id,
      action: AuditAction.UPDATE,
      before: existing,
      after: job,
    });
    return job;
  });

  await computeCostRollups({ jobId: updated.id });
  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "upfit.statusChanged",
    entityType: "UpfitJob",
    entityId: updated.id,
    payload: {
      previousStatus: existing.status,
      nextStatus: updated.status,
    },
  });
  return updated;
}

export async function addUpfitMilestone(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const input = upfitMilestoneCreateSchema.parse(rawInput);
  const job = await prisma.upfitJob.findFirst({
    where: { id: input.jobId, orgId: ctx.orgId },
    select: { id: true },
  });
  if (!job) throw new AppError("Upfit job not found.", 404);

  return prisma.upfitMilestone.create({
    data: {
      orgId: ctx.orgId,
      upfitJobId: input.jobId,
      name: input.name,
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
    },
  });
}

export async function completeUpfitMilestone(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const input = upfitMilestoneCompleteSchema.parse(rawInput);
  const existing = await prisma.upfitMilestone.findFirst({
    where: { id: input.milestoneId, orgId: ctx.orgId },
    include: {
      upfitJob: true,
    },
  });
  if (!existing) throw new AppError("Upfit milestone not found.", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const milestone = await tx.upfitMilestone.update({
      where: { id: input.milestoneId },
      data: {
        completedAt: new Date(),
        completedById: ctx.userId,
      },
    });

    const incomplete = await tx.upfitMilestone.count({
      where: {
        orgId: ctx.orgId,
        upfitJobId: existing.upfitJobId,
        completedAt: null,
      },
    });
    if (incomplete === 0 && existing.upfitJob.status !== UpfitJobStatus.COMPLETED) {
      await tx.upfitJob.update({
        where: { id: existing.upfitJobId },
        data: { status: UpfitJobStatus.COMPLETED },
      });
    }

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "UpfitMilestone",
      entityId: milestone.id,
      action: AuditAction.UPDATE,
      before: existing,
      after: milestone,
    });
    return milestone;
  });

  await computeCostRollups({ jobId: existing.upfitJobId });
  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "upfit.milestoneCompleted",
    entityType: "UpfitMilestone",
    entityId: updated.id,
    payload: {
      upfitJobId: existing.upfitJobId,
      milestone: updated.name,
      completedAt: updated.completedAt?.toISOString(),
    },
  });

  return updated;
}

export async function computeCostRollups(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const input = upfitRollupSchema.parse(rawInput);
  const job = input.jobId
    ? await prisma.upfitJob.findFirst({
        where: { id: input.jobId, orgId: ctx.orgId },
      })
    : null;
  if (input.jobId && !job) throw new AppError("Upfit job not found.", 404);

  const quoteId = input.quoteId ?? job?.quoteId ?? null;
  const dealId = input.dealId ?? job?.dealId ?? null;

  return prisma.$transaction(async (tx) => {
    if (quoteId) {
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, orgId: ctx.orgId },
      });
      if (quote) {
        const jobs = await tx.upfitJob.findMany({
          where: { orgId: ctx.orgId, quoteId },
        });
        const rollup = calculateUpfitRollupAmount(
          jobs.map((item) => ({
            billableToCustomer: item.billableToCustomer,
            includeActualCosts: item.includeActualCosts,
            costEstimate: Number(item.costEstimate),
            actualCost: Number(item.actualCost),
          })),
        );

        const autoLine = await tx.quoteLine.findFirst({
          where: {
            orgId: ctx.orgId,
            quoteId,
            metadataJson: {
              path: ["upfitRollup"],
              equals: true,
            },
          },
        });
        if (autoLine) {
          await tx.quoteLine.update({
            where: { id: autoLine.id },
            data: {
              description: "Upfit Cost Rollup",
              quantity: 1,
              unitPrice: rollup.billableAmount,
              taxable: false,
              unitCost: rollup.actualCost,
              metadataJson: {
                upfitRollup: true,
              },
            },
          });
        } else if (rollup.billableAmount > 0 || rollup.actualCost > 0) {
          await tx.quoteLine.create({
            data: {
              orgId: ctx.orgId,
              quoteId,
              description: "Upfit Cost Rollup",
              quantity: 1,
              unitPrice: rollup.billableAmount,
              taxable: false,
              unitCost: rollup.actualCost,
              metadataJson: {
                upfitRollup: true,
              },
            },
          });
        }

        await recomputeQuoteFromDb(tx, ctx.orgId, quoteId);
      }
    }

    if (dealId) {
      const deal = await tx.deal.findFirst({
        where: { id: dealId, orgId: ctx.orgId },
      });
      if (deal) {
        const jobs = await tx.upfitJob.findMany({
          where: { orgId: ctx.orgId, dealId },
        });
        const amount = calculateUpfitRollupAmount(
          jobs.map((item) => ({
            billableToCustomer: item.billableToCustomer,
            includeActualCosts: item.includeActualCosts,
            costEstimate: Number(item.costEstimate),
            actualCost: Number(item.actualCost),
          })),
        ).billableAmount;

        const existingLine = await tx.dealLineItem.findFirst({
          where: {
            orgId: ctx.orgId,
            dealId,
            type: "UPFIT",
            label: "Upfit Cost Rollup",
          },
        });
        if (existingLine) {
          await tx.dealLineItem.update({
            where: { id: existingLine.id },
            data: { amount },
          });
        } else if (amount > 0) {
          await tx.dealLineItem.create({
            data: {
              orgId: ctx.orgId,
              dealId,
              type: "UPFIT",
              label: "Upfit Cost Rollup",
              amount,
            },
          });
        }
      }
    }

    return { ok: true, quoteId, dealId };
  });
}
