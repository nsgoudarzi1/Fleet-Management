import { AuditAction, FundingCaseStatus, PermissionScope, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext, requirePerm } from "@/lib/services/guard";
import { emitWebhookEvent } from "@/lib/services/integrations";
import {
  fundingCaseCreateSchema,
  fundingCaseStatusSchema,
  fundingCaseUpdateSchema,
  fundingQueueFilterSchema,
  fundingStipUpsertSchema,
} from "@/lib/validations/funding";

export async function listFundingQueue(filters: unknown) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const parsed = fundingQueueFilterSchema.parse(filters ?? {});

  const where = {
    orgId: ctx.orgId,
    ...(parsed.status ? { status: parsed.status } : {}),
    ...(parsed.query
      ? {
          OR: [
            { lenderName: { contains: parsed.query, mode: "insensitive" as const } },
            {
              deal: {
                OR: [
                  { dealNumber: { contains: parsed.query, mode: "insensitive" as const } },
                  {
                    customer: {
                      OR: [
                        { firstName: { contains: parsed.query, mode: "insensitive" as const } },
                        { lastName: { contains: parsed.query, mode: "insensitive" as const } },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const items = await prisma.fundingCase.findMany({
    where,
    include: {
      deal: {
        include: {
          customer: true,
          vehicle: true,
        },
      },
      stips: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return items.map((item) => {
    const requiredStips = item.stips.filter((stip) => stip.required);
    const missing = requiredStips.filter((stip) => !stip.receivedAt || !stip.verifiedAt);
    const agingStart = item.submittedAt ?? item.createdAt;
    const agingDays = Math.max(0, Math.round((Date.now() - agingStart.getTime()) / 86400000));

    return {
      ...item,
      blockers: missing.length,
      blockerTypes: missing.map((stip) => stip.docType),
      agingDays,
    };
  });
}

export async function getDealFundingCase(dealId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  return prisma.fundingCase.findFirst({
    where: { orgId: ctx.orgId, dealId },
    include: {
      stips: { orderBy: { createdAt: "asc" } },
      deal: {
        include: {
          customer: true,
          vehicle: true,
        },
      },
      createdBy: true,
    },
  });
}

export async function createFundingCase(input: unknown) {
  const ctx = await requirePerm(PermissionScope.FUNDING_MANAGE);
  const parsed = fundingCaseCreateSchema.parse(input);

  const deal = await prisma.deal.findFirst({ where: { id: parsed.dealId, orgId: ctx.orgId } });
  if (!deal) throw new AppError("Deal not found.", 404);

  const existing = await prisma.fundingCase.findFirst({ where: { orgId: ctx.orgId, dealId: parsed.dealId } });
  if (existing) throw new AppError("Funding case already exists for this deal.", 409);

  const fundingCase = await prisma.$transaction(async (tx) => {
    const created = await tx.fundingCase.create({
      data: {
        orgId: ctx.orgId,
        dealId: parsed.dealId,
        lenderName: parsed.lenderName,
        lenderContactName: parsed.lenderContactName,
        lenderContactEmail: parsed.lenderContactEmail,
        lenderContactPhone: parsed.lenderContactPhone,
        amountFinanced: parsed.amountFinanced,
        reserveAmount: parsed.reserveAmount,
        feeTotal: parsed.feeTotal,
        nextAction: parsed.nextAction,
        nextActionAt: parsed.nextActionAt ? new Date(parsed.nextActionAt) : undefined,
        notes: parsed.notes,
        createdById: ctx.userId,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "FundingCase",
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });

    return created;
  });

  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "fundingCase.created",
    entityType: "FundingCase",
    entityId: fundingCase.id,
    payload: {
      dealId: fundingCase.dealId,
      status: fundingCase.status,
      lenderName: fundingCase.lenderName,
    },
  });

  return fundingCase;
}

export async function updateFundingCase(input: unknown) {
  const ctx = await requirePerm(PermissionScope.FUNDING_MANAGE);
  const parsed = fundingCaseUpdateSchema.parse(input);

  const existing = await prisma.fundingCase.findFirst({
    where: { id: parsed.fundingCaseId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Funding case not found.", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.fundingCase.update({
      where: { id: parsed.fundingCaseId },
      data: {
        lenderName: parsed.lenderName,
        lenderContactName: parsed.lenderContactName,
        lenderContactEmail: parsed.lenderContactEmail,
        lenderContactPhone: parsed.lenderContactPhone,
        amountFinanced: parsed.amountFinanced,
        reserveAmount: parsed.reserveAmount,
        feeTotal: parsed.feeTotal,
        nextAction: parsed.nextAction,
        nextActionAt: parsed.nextActionAt ? new Date(parsed.nextActionAt) : undefined,
        notes: parsed.notes,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "FundingCase",
      entityId: row.id,
      action: AuditAction.UPDATE,
      before: existing,
      after: row,
    });

    return row;
  });

  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "fundingCase.updated",
    entityType: "FundingCase",
    entityId: updated.id,
    payload: {
      status: updated.status,
      nextAction: updated.nextAction,
      nextActionAt: updated.nextActionAt?.toISOString() ?? null,
    },
  });

  return updated;
}

function statusDatePatch(status: FundingCaseStatus) {
  const now = new Date();
  switch (status) {
    case "SUBMITTED":
      return { submittedAt: now };
    case "APPROVED":
      return { approvedAt: now };
    case "FUNDED":
      return { fundedAt: now };
    case "PAID_OUT":
      return { paidOutAt: now };
    case "CLOSED":
      return { closedAt: now };
    default:
      return {};
  }
}

export async function transitionFundingCaseStatus(input: unknown) {
  const ctx = await requirePerm(PermissionScope.FUNDING_MANAGE);
  const parsed = fundingCaseStatusSchema.parse(input);

  const existing = await prisma.fundingCase.findFirst({
    where: { id: parsed.fundingCaseId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Funding case not found.", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.fundingCase.update({
      where: { id: parsed.fundingCaseId },
      data: {
        status: parsed.status,
        ...statusDatePatch(parsed.status),
        notes: parsed.note ? `${existing.notes ?? ""}\n${parsed.note}`.trim() : existing.notes,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "FundingCase",
      entityId: row.id,
      action: AuditAction.UPDATE,
      before: existing,
      after: row,
    });

    return row;
  });

  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "fundingCase.statusChanged",
    entityType: "FundingCase",
    entityId: updated.id,
    payload: {
      previousStatus: existing.status,
      nextStatus: updated.status,
    },
  });

  return updated;
}

export async function upsertFundingStip(input: unknown) {
  const ctx = await requirePerm(PermissionScope.FUNDING_MANAGE);
  const parsed = fundingStipUpsertSchema.parse(input);

  const fundingCase = await prisma.fundingCase.findFirst({
    where: { id: parsed.fundingCaseId, orgId: ctx.orgId },
  });
  if (!fundingCase) throw new AppError("Funding case not found.", 404);

  const existing = parsed.stipId
    ? await prisma.fundingStip.findFirst({
        where: {
          id: parsed.stipId,
          orgId: ctx.orgId,
          fundingCaseId: parsed.fundingCaseId,
        },
      })
    : null;

  const now = new Date();
  const attachmentJson = parsed.attachmentJson as Prisma.InputJsonValue | undefined;

  const stipend = await prisma.$transaction(async (tx) => {
    const row = existing
      ? await tx.fundingStip.update({
          where: { id: existing.id },
          data: {
            docType: parsed.docType,
            required: parsed.required,
            receivedAt: parsed.received === undefined ? existing.receivedAt : parsed.received ? now : null,
            verifiedAt: parsed.verified === undefined ? existing.verifiedAt : parsed.verified ? now : null,
            verifiedById: parsed.verified === undefined ? existing.verifiedById : parsed.verified ? ctx.userId : null,
            notes: parsed.notes,
            attachmentJson,
          },
        })
      : await tx.fundingStip.create({
          data: {
            orgId: ctx.orgId,
            fundingCaseId: parsed.fundingCaseId,
            docType: parsed.docType,
            required: parsed.required,
            receivedAt: parsed.received ? now : null,
            verifiedAt: parsed.verified ? now : null,
            verifiedById: parsed.verified ? ctx.userId : null,
            notes: parsed.notes,
            attachmentJson,
          },
        });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "FundingStip",
      entityId: row.id,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      before: existing ?? undefined,
      after: row,
    });

    return row;
  });

  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "fundingStip.updated",
    entityType: "FundingStip",
    entityId: stipend.id,
    payload: {
      fundingCaseId: stipend.fundingCaseId,
      docType: stipend.docType,
      required: stipend.required,
      receivedAt: stipend.receivedAt?.toISOString() ?? null,
      verifiedAt: stipend.verifiedAt?.toISOString() ?? null,
    },
  });

  return stipend;
}
