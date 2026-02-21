import { randomUUID } from "node:crypto";
import { ApprovalStatus, AuditAction, QuoteStatus, Role, type Prisma } from "@prisma/client";
import { renderDocumentArtifact } from "@/lib/documents/pdf-adapter";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext } from "@/lib/services/guard";
import { calculateQuoteTotals } from "@/lib/services/quote-math";
import {
  approvalCreateSchema,
  approvalReviewSchema,
  quoteCreateSchema,
  quoteLineCreateSchema,
  quoteLineDeleteSchema,
  quoteListSchema,
  quoteShareSchema,
  quoteStatusUpdateSchema,
} from "@/lib/validations/quotes";

async function nextQuoteNumber(orgId: string) {
  const year = new Date().getFullYear();
  const total = await prisma.quote.count({
    where: {
      orgId,
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      },
    },
  });
  return `Q-${year}-${String(total + 1).padStart(4, "0")}`;
}

async function recomputeQuote(tx: Prisma.TransactionClient, orgId: string, quoteId: string) {
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

  const aggregate = calculateQuoteTotals(
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
    data: aggregate,
  });
}

export async function listQuotes(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const input = quoteListSchema.parse(rawInput ?? {});
  const where = {
    orgId: ctx.orgId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            { quoteNumber: { contains: input.q, mode: "insensitive" as const } },
            {
              customer: {
                OR: [
                  { firstName: { contains: input.q, mode: "insensitive" as const } },
                  { lastName: { contains: input.q, mode: "insensitive" as const } },
                ],
              },
            },
            {
              fleetAccount: {
                name: { contains: input.q, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.quote.findMany({
      where,
      include: {
        customer: true,
        fleetAccount: true,
        lines: {
          include: { vehicle: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.quote.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function getQuoteDetail(quoteId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      orgId: ctx.orgId,
    },
    include: {
      customer: true,
      fleetAccount: {
        include: {
          memberships: {
            include: { customer: true },
          },
        },
      },
      deal: true,
      lines: {
        include: {
          vehicle: true,
        },
        orderBy: { createdAt: "asc" },
      },
      approvals: {
        orderBy: { createdAt: "desc" },
      },
      upfitJobs: {
        include: {
          vendor: true,
          milestones: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!quote) throw new AppError("Quote not found.", 404);
  return quote;
}

export async function createQuote(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const input = quoteCreateSchema.parse(rawInput);
  const [customer, fleetAccount, deal] = await Promise.all([
    input.customerId
      ? prisma.customer.findFirst({
          where: { id: input.customerId, orgId: ctx.orgId },
          select: { id: true },
        })
      : Promise.resolve(null),
    input.fleetAccountId
      ? prisma.fleetAccount.findFirst({
          where: { id: input.fleetAccountId, orgId: ctx.orgId },
          select: { id: true },
        })
      : Promise.resolve(null),
    input.dealId
      ? prisma.deal.findFirst({
          where: { id: input.dealId, orgId: ctx.orgId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (input.customerId && !customer) throw new AppError("Customer not found.", 404);
  if (input.fleetAccountId && !fleetAccount) throw new AppError("Fleet account not found.", 404);
  if (input.dealId && !deal) throw new AppError("Deal not found.", 404);

  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.create({
      data: {
        orgId: ctx.orgId,
        quoteNumber: await nextQuoteNumber(ctx.orgId),
        status: QuoteStatus.DRAFT,
        customerId: input.customerId,
        fleetAccountId: input.fleetAccountId,
        dealId: input.dealId,
        createdById: ctx.userId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        notes: input.notes,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Quote",
      entityId: quote.id,
      action: AuditAction.CREATE,
      after: quote,
    });
    return quote;
  });
}

export async function addQuoteLine(quoteId: string, rawInput: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const input = quoteLineCreateSchema.parse(rawInput);
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, orgId: ctx.orgId },
  });
  if (!quote) throw new AppError("Quote not found.", 404);

  if (input.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: input.vehicleId, orgId: ctx.orgId },
      select: { id: true },
    });
    if (!vehicle) throw new AppError("Vehicle not found.", 404);
  }

  return prisma.$transaction(async (tx) => {
    const line = await tx.quoteLine.create({
      data: {
        orgId: ctx.orgId,
        quoteId,
        vehicleId: input.vehicleId,
        description: input.description,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        taxable: input.taxable,
        unitCost: input.unitCost,
      },
    });
    const updatedQuote = await recomputeQuote(tx, ctx.orgId, quoteId);

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "QuoteLine",
      entityId: line.id,
      action: AuditAction.CREATE,
      after: line,
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Quote",
      entityId: quoteId,
      action: AuditAction.UPDATE,
      before: quote,
      after: updatedQuote,
    });
    return line;
  });
}

export async function removeQuoteLine(quoteId: string, rawInput: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const input = quoteLineDeleteSchema.parse(rawInput);

  const [quote, line] = await Promise.all([
    prisma.quote.findFirst({
      where: { id: quoteId, orgId: ctx.orgId },
    }),
    prisma.quoteLine.findFirst({
      where: { id: input.lineId, quoteId, orgId: ctx.orgId },
    }),
  ]);
  if (!quote) throw new AppError("Quote not found.", 404);
  if (!line) throw new AppError("Quote line not found.", 404);

  return prisma.$transaction(async (tx) => {
    await tx.quoteLine.delete({
      where: { id: input.lineId },
    });
    const updatedQuote = await recomputeQuote(tx, ctx.orgId, quoteId);
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "QuoteLine",
      entityId: line.id,
      action: AuditAction.DELETE,
      before: line,
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Quote",
      entityId: quoteId,
      action: AuditAction.UPDATE,
      before: quote,
      after: updatedQuote,
    });
    return updatedQuote;
  });
}

export async function updateQuoteStatus(quoteId: string, rawInput: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const input = quoteStatusUpdateSchema.parse(rawInput);
  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Quote not found.", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: input.status,
        sentAt: input.status === QuoteStatus.SENT ? new Date() : existing.sentAt,
        acceptedAt: input.status === QuoteStatus.ACCEPTED ? new Date() : existing.acceptedAt,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Quote",
      entityId: quoteId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });
    return updated;
  });
}

export async function createQuoteShareLink(quoteId: string, rawInput: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const input = quoteShareSchema.parse(rawInput ?? {});
  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Quote not found.", 404);

  const token = randomUUID();
  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: {
      shareToken: token,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : existing.expiresAt,
      status: existing.status === QuoteStatus.DRAFT ? QuoteStatus.SENT : existing.status,
      sentAt: existing.sentAt ?? new Date(),
    },
  });
  return {
    token,
    quoteId: updated.id,
    sharePath: `/quotes/share/${token}`,
    expiresAt: updated.expiresAt,
  };
}

function renderQuotePdfHtml(quote: Awaited<ReturnType<typeof getQuoteDetail>>) {
  const customerName = quote.customer
    ? `${quote.customer.firstName} ${quote.customer.lastName}`
    : quote.fleetAccount?.name ?? "Fleet Customer";
  const lines = quote.lines
    .map(
      (line) =>
        `<tr><td>${line.description}</td><td>${Number(line.quantity).toFixed(2)}</td><td>$${Number(line.unitPrice).toFixed(2)}</td><td>$${Number(line.lineTotal).toFixed(2)}</td></tr>`,
    )
    .join("");

  return `
<h1>Quote ${quote.quoteNumber}</h1>
<div class="section">
  <div class="field-row"><span class="field-label">Customer</span><span class="field-value">${customerName}</span></div>
  <div class="field-row"><span class="field-label">Status</span><span class="field-value">${quote.status}</span></div>
  <div class="field-row"><span class="field-label">Expires</span><span class="field-value">${quote.expiresAt ? quote.expiresAt.toISOString().slice(0, 10) : "-"}</span></div>
</div>
<div class="section">
  <table style="width:100%; border-collapse: collapse;">
    <thead>
      <tr><th style="text-align:left">Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr>
    </thead>
    <tbody>${lines}</tbody>
  </table>
</div>
<div class="section">
  <div class="field-row"><span class="field-label">Subtotal</span><span class="field-value">$${Number(quote.subtotal).toFixed(2)}</span></div>
  <div class="field-row"><span class="field-label">Tax</span><span class="field-value">$${Number(quote.taxTotal).toFixed(2)}</span></div>
  <div class="field-row"><span class="field-label">Total</span><span class="field-value">$${Number(quote.total).toFixed(2)}</span></div>
  <div class="field-row"><span class="field-label">Gross</span><span class="field-value">$${Number(quote.grossTotal).toFixed(2)}</span></div>
</div>
<div class="notice">Not legal advice. Confirm taxes, terms, and contract language before acceptance.</div>
`.trim();
}

export async function generateQuotePdf(quoteId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const quote = await getQuoteDetail(quoteId);
  const artifact = await renderDocumentArtifact({
    title: quote.quoteNumber,
    htmlContent: renderQuotePdfHtml(quote),
  });

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Quote",
      entityId: quoteId,
      action: AuditAction.UPDATE,
      before: quote,
      after: {
        generatedQuoteAt: new Date().toISOString(),
      },
    });
  });

  return {
    buffer: artifact.buffer,
    contentType: artifact.contentType,
    fileName: `${quote.quoteNumber}.${artifact.extension}`,
    mode: artifact.mode,
  };
}

export async function listApprovalRequests() {
  const ctx = await requireOrgContext(Role.VIEWER);
  return prisma.discountApprovalRequest.findMany({
    where: {
      orgId: ctx.orgId,
    },
    include: {
      requestedBy: true,
      reviewedBy: true,
      quote: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function createDiscountApprovalRequest(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.SALES);
  const input = approvalCreateSchema.parse(rawInput);

  if (input.quoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: input.quoteId, orgId: ctx.orgId },
      select: { id: true },
    });
    if (!quote) throw new AppError("Quote not found.", 404);
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.discountApprovalRequest.create({
      data: {
        orgId: ctx.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        quoteId: input.quoteId,
        requestedById: ctx.userId,
        reason: input.reason,
        delta: input.delta,
        status: ApprovalStatus.PENDING,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DiscountApprovalRequest",
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });
    return created;
  });
}

export async function reviewDiscountApprovalRequest(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const input = approvalReviewSchema.parse(rawInput);
  const existing = await prisma.discountApprovalRequest.findFirst({
    where: { id: input.approvalId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Approval request not found.", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.discountApprovalRequest.update({
      where: { id: input.approvalId },
      data: {
        status: input.status,
        reviewedById: ctx.userId,
        reviewedAt: new Date(),
        responseNote: input.responseNote,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "DiscountApprovalRequest",
      entityId: existing.id,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });
    return updated;
  });
}

export async function getQuoteByShareToken(token: string) {
  const quote = await prisma.quote.findFirst({
    where: {
      shareToken: token,
      status: { in: [QuoteStatus.SENT, QuoteStatus.ACCEPTED] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      customer: true,
      fleetAccount: true,
      lines: {
        include: { vehicle: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!quote) throw new AppError("Shared quote is unavailable.", 404);
  return quote;
}

export async function acceptQuoteByShareToken(token: string) {
  const quote = await getQuoteByShareToken(token);
  return prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: QuoteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });
}
