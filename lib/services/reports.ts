import { ApprovalStatus, QuoteStatus, Role, UpfitJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/services/guard";

function daysSince(input: Date) {
  return Math.max(0, Math.floor((Date.now() - input.getTime()) / 86_400_000));
}

function bucketAging(days: number) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export async function getOperationsReports() {
  const ctx = await requireOrgContext(Role.VIEWER);

  const [vehicles, quotes, fundingCases, upfitJobs, checklistItems, approvals] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        orgId: ctx.orgId,
        status: { in: ["ACQUIRED", "RECON", "READY", "LISTED", "ON_HOLD"] },
      },
      include: {
        deals: {
          where: { stage: { in: ["DRAFT", "SUBMITTED", "APPROVED", "CONTRACTED"] } },
          select: { id: true },
        },
      },
      orderBy: { acquiredAt: "asc" },
    }),
    prisma.quote.findMany({
      where: {
        orgId: ctx.orgId,
        status: { in: [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.EXPIRED] },
      },
      include: {
        customer: true,
        fleetAccount: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.fundingCase.findMany({
      where: {
        orgId: ctx.orgId,
        status: { in: ["NOT_SUBMITTED", "SUBMITTED", "STIPS_REQUESTED", "APPROVED"] },
      },
      include: {
        deal: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.upfitJob.findMany({
      where: {
        orgId: ctx.orgId,
        status: { in: [UpfitJobStatus.PLANNED, UpfitJobStatus.IN_PROGRESS, UpfitJobStatus.WAITING_PARTS] },
      },
      include: {
        vehicle: true,
        deal: true,
        quote: true,
        vendor: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dealDocumentChecklistItem.findMany({
      where: {
        orgId: ctx.orgId,
        status: { in: ["BLOCKED", "MISSING_DATA", "PENDING"] },
      },
      include: {
        deal: true,
        packTemplate: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.discountApprovalRequest.findMany({
      where: { orgId: ctx.orgId },
      include: { quote: true, requestedBy: true, reviewedBy: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const inventoryAgingBuckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const vehicle of vehicles) {
    const bucket = bucketAging(daysSince(vehicle.acquiredAt));
    inventoryAgingBuckets[bucket] += 1;
  }

  const quoteAging = quotes.map((quote) => ({
    ...quote,
    agingDays: daysSince(quote.createdAt),
    followUpDue: quote.status !== QuoteStatus.ACCEPTED && quote.status !== QuoteStatus.EXPIRED,
  }));

  const fundingAging = fundingCases.map((item) => ({
    id: item.id,
    dealId: item.dealId,
    dealNumber: item.deal.dealNumber,
    customerName: `${item.deal.customer.firstName} ${item.deal.customer.lastName}`,
    status: item.status,
    agingDays: daysSince(item.createdAt),
    nextActionAt: item.nextActionAt,
  }));

  const upfitAging = upfitJobs.map((job) => ({
    ...job,
    agingDays: daysSince(job.createdAt),
  }));

  const checklistExceptions = checklistItems.map((item) => ({
    id: item.id,
    dealId: item.dealId,
    dealNumber: item.deal.dealNumber,
    packName: item.packTemplate?.name ?? "Unknown Pack",
    documentType: item.documentType,
    status: item.status,
    blocking: item.blocking,
    createdAt: item.createdAt,
  }));

  const negativeGrossQuotes = quotes.filter((quote) => Number(quote.grossTotal) < 0);
  const pendingApprovals = approvals.filter((approval) => approval.status === ApprovalStatus.PENDING);
  const unapprovedDiscounts = approvals.filter((approval) =>
    approval.status !== ApprovalStatus.APPROVED && Number(approval.delta) < 0,
  );

  return {
    inventoryAgingBuckets,
    inventoryAging: vehicles.map((vehicle) => ({
      id: vehicle.id,
      stockNumber: vehicle.stockNumber,
      status: vehicle.status,
      acquiredAt: vehicle.acquiredAt,
      agingDays: daysSince(vehicle.acquiredAt),
      hasOpenDeal: vehicle.deals.length > 0,
    })),
    quoteAging,
    fundingAging,
    upfitAging,
    checklistExceptions,
    exceptions: {
      negativeGrossQuotes,
      pendingApprovals,
      unapprovedDiscounts,
    },
  };
}
