import { AuditAction, JournalSourceType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { emitWebhookEvent } from "@/lib/services/integrations";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext } from "@/lib/services/guard";
import {
  accountingPeriodCloseSchema,
  chartOfAccountCreateSchema,
  chartOfAccountUpdateSchema,
  paymentCreateSchema,
  postingAccountMapSchema,
} from "@/lib/validations/accounting";

type PaymentFilters = {
  page?: number;
  pageSize?: number;
};

type JournalDraftLine = {
  key: string;
  debit?: number;
  credit?: number;
  description?: string;
  entityType?: string;
  entityId?: string;
};

type Tx = Prisma.TransactionClient;

function toDecimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function decimalToNumber(value: Prisma.Decimal | number | string) {
  return Number(value);
}

function monthPeriodBounds(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0) - 1);
  const periodKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end, periodKey };
}

async function ensureOpenPeriod(tx: Tx, orgId: string, postingDate: Date, actorId?: string | null) {
  const existing = await tx.accountingPeriod.findFirst({
    where: {
      orgId,
      startDate: { lte: postingDate },
      endDate: { gte: postingDate },
    },
  });

  if (existing) {
    if (existing.status === "CLOSED") {
      throw new AppError(`Accounting period ${existing.periodKey} is closed.`, 400);
    }
    return existing;
  }

  const bounds = monthPeriodBounds(postingDate);
  return tx.accountingPeriod.create({
    data: {
      orgId,
      periodKey: bounds.periodKey,
      startDate: bounds.start,
      endDate: bounds.end,
      closedById: actorId ?? undefined,
    },
  });
}

async function nextEntryNumber(tx: Tx, orgId: string, postingDate: Date) {
  const year = postingDate.getUTCFullYear();
  const count = await tx.journalEntry.count({
    where: {
      orgId,
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      },
    },
  });
  return `JE-${year}-${String(count + 1).padStart(4, "0")}`;
}

async function resolvePostingAccounts(tx: Tx, orgId: string, sourceType: JournalSourceType, keys: string[]) {
  const maps = await tx.postingAccountMap.findMany({
    where: {
      orgId,
      sourceType,
      key: { in: keys },
    },
    include: {
      account: true,
    },
  });
  const byKey = new Map(maps.map((row) => [row.key, row.account]));

  const missing = keys.filter((key) => !byKey.has(key));
  if (missing.length) {
    throw new AppError(
      `Posting map missing for ${sourceType}: ${missing.join(", ")}. Configure account mappings in Accounting settings.`,
      400,
    );
  }
  return byKey;
}

async function postEntryFromDraft(input: {
  tx: Tx;
  orgId: string;
  actorId?: string | null;
  sourceType: JournalSourceType;
  sourceId?: string | null;
  description: string;
  postedAt: Date;
  lines: JournalDraftLine[];
}) {
  const debitTotal = input.lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
  const creditTotal = input.lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
  const delta = Math.abs(debitTotal - creditTotal);

  if (delta > 0.009) {
    throw new AppError("Journal entry is not balanced.", 400);
  }

  const period = await ensureOpenPeriod(input.tx, input.orgId, input.postedAt, input.actorId);
  const keys = Array.from(new Set(input.lines.map((line) => line.key)));
  const accountsByKey = await resolvePostingAccounts(input.tx, input.orgId, input.sourceType, keys);

  for (const account of accountsByKey.values()) {
    if (!account.isPostingAllowed || !account.isActive) {
      throw new AppError(`Account ${account.code} is not available for posting.`, 400);
    }
  }

  const entry = await input.tx.journalEntry.create({
    data: {
      orgId: input.orgId,
      entryNumber: await nextEntryNumber(input.tx, input.orgId, input.postedAt),
      description: input.description,
      postedAt: input.postedAt,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      periodId: period.id,
      totalDebit: toDecimal(debitTotal),
      totalCredit: toDecimal(creditTotal),
      createdById: input.actorId ?? undefined,
    },
  });

  await input.tx.journalLine.createMany({
    data: input.lines.map((line) => ({
      orgId: input.orgId,
      journalEntryId: entry.id,
      accountId: accountsByKey.get(line.key)!.id,
      description: line.description,
      debit: toDecimal(line.debit ?? 0),
      credit: toDecimal(line.credit ?? 0),
      entityType: line.entityType,
      entityId: line.entityId,
    })),
  });

  await recordAudit(input.tx, {
    orgId: input.orgId,
    actorId: input.actorId,
    entityType: "JournalEntry",
    entityId: entry.id,
    action: AuditAction.CREATE,
    after: {
      id: entry.id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      debitTotal,
      creditTotal,
    },
  });

  await emitWebhookEvent({
    orgId: input.orgId,
    eventType: "journalEntry.posted",
    entityType: "JournalEntry",
    entityId: entry.id,
    payload: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      postedAt: input.postedAt.toISOString(),
      totalDebit: debitTotal,
      totalCredit: creditTotal,
    },
  });

  return entry;
}

export async function listPayments(filters: PaymentFilters = {}) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const where = { orgId: ctx.orgId };

  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        deal: true,
        customer: true,
        createdBy: true,
      },
      orderBy: { postedAt: "desc" },
    }),
    prisma.payment.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function createPayment(input: unknown) {
  const ctx = await requireOrgContext(Role.ACCOUNTING);
  const parsed = paymentCreateSchema.parse(input);

  if (!parsed.dealId && !parsed.customerId) {
    throw new AppError("Payment must be linked to a deal or customer.", 400);
  }

  if (parsed.dealId) {
    const deal = await prisma.deal.findFirst({
      where: {
        id: parsed.dealId,
        orgId: ctx.orgId,
      },
    });
    if (!deal) throw new AppError("Deal not found.", 404);
  }

  if (parsed.customerId) {
    const customer = await prisma.customer.findFirst({
      where: {
        id: parsed.customerId,
        orgId: ctx.orgId,
      },
    });
    if (!customer) throw new AppError("Customer not found.", 404);
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        orgId: ctx.orgId,
        dealId: parsed.dealId,
        customerId: parsed.customerId,
        amount: parsed.amount,
        method: parsed.method,
        reference: parsed.reference,
        postedAt: parsed.postedAt ? new Date(parsed.postedAt) : new Date(),
        notes: parsed.notes,
        createdById: ctx.userId,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Payment",
      entityId: payment.id,
      action: AuditAction.CREATE,
      after: payment,
    });

    return payment;
  });
}

export async function deletePayment(paymentId: string) {
  const ctx = await requireOrgContext(Role.ADMIN);
  const existing = await prisma.payment.findFirst({
    where: { id: paymentId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Payment not found.", 404);

  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: paymentId } });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Payment",
      entityId: paymentId,
      action: AuditAction.DELETE,
      before: existing,
    });
  });
}

export async function listChartOfAccounts() {
  const ctx = await requireOrgContext(Role.VIEWER);
  const [accounts, mappings] = await Promise.all([
    prisma.chartOfAccount.findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ code: "asc" }],
    }),
    prisma.postingAccountMap.findMany({
      where: { orgId: ctx.orgId },
      include: { account: true },
      orderBy: [{ sourceType: "asc" }, { key: "asc" }],
    }),
  ]);
  return { accounts, mappings };
}

export async function createChartOfAccount(input: unknown) {
  const ctx = await requireOrgContext(Role.ADMIN);
  const parsed = chartOfAccountCreateSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const account = await tx.chartOfAccount.create({
      data: {
        orgId: ctx.orgId,
        code: parsed.code,
        name: parsed.name,
        type: parsed.type,
        description: parsed.description,
        isPostingAllowed: parsed.isPostingAllowed,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ChartOfAccount",
      entityId: account.id,
      action: AuditAction.CREATE,
      after: account,
    });
    return account;
  });
}

export async function updateChartOfAccount(accountId: string, input: unknown) {
  const ctx = await requireOrgContext(Role.ADMIN);
  const parsed = chartOfAccountUpdateSchema.parse(input);

  const existing = await prisma.chartOfAccount.findFirst({
    where: { id: accountId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Account not found.", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.chartOfAccount.update({
      where: { id: accountId },
      data: parsed,
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ChartOfAccount",
      entityId: accountId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function upsertPostingAccountMap(input: unknown) {
  const ctx = await requireOrgContext(Role.ADMIN);
  const parsed = postingAccountMapSchema.parse(input);

  const account = await prisma.chartOfAccount.findFirst({
    where: {
      id: parsed.accountId,
      orgId: ctx.orgId,
    },
  });
  if (!account) throw new AppError("Account not found for this organization.", 404);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.postingAccountMap.findUnique({
      where: {
        orgId_sourceType_key: {
          orgId: ctx.orgId,
          sourceType: parsed.sourceType,
          key: parsed.key,
        },
      },
    });

    const map = await tx.postingAccountMap.upsert({
      where: {
        orgId_sourceType_key: {
          orgId: ctx.orgId,
          sourceType: parsed.sourceType,
          key: parsed.key,
        },
      },
      create: {
        orgId: ctx.orgId,
        sourceType: parsed.sourceType,
        key: parsed.key,
        accountId: parsed.accountId,
      },
      update: {
        accountId: parsed.accountId,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "PostingAccountMap",
      entityId: map.id,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      before: existing,
      after: map,
    });

    return map;
  });
}

export async function listJournalEntries(filters: { page?: number; pageSize?: number } = {}) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const [items, total] = await prisma.$transaction([
    prisma.journalEntry.findMany({
      where: { orgId: ctx.orgId },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
        period: true,
      },
      orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.journalEntry.count({ where: { orgId: ctx.orgId } }),
  ]);

  return { items, total, page, pageSize };
}

export async function listAccountingPeriods() {
  const ctx = await requireOrgContext(Role.VIEWER);
  return prisma.accountingPeriod.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { startDate: "desc" },
  });
}

export async function closeAccountingPeriod(input: unknown) {
  const ctx = await requireOrgContext(Role.ADMIN);
  const parsed = accountingPeriodCloseSchema.parse(input);

  const existing = await prisma.accountingPeriod.findFirst({
    where: { id: parsed.periodId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Accounting period not found.", 404);
  if (existing.status === "CLOSED") return existing;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.accountingPeriod.update({
      where: { id: parsed.periodId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: ctx.userId,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "AccountingPeriod",
      entityId: parsed.periodId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function postRepairOrderClose(input: {
  orgId: string;
  repairOrderId: string;
  actorId?: string | null;
  paymentMethod?: "CASH" | "ACH" | "CREDIT_CARD" | "CHECK" | "OTHER";
  paymentReference?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const existingEntry = await tx.journalEntry.findFirst({
      where: {
        orgId: input.orgId,
        sourceType: JournalSourceType.RO_CLOSE,
        sourceId: input.repairOrderId,
      },
    });
    if (existingEntry) return existingEntry;

    const ro = await tx.repairOrder.findFirst({
      where: { id: input.repairOrderId, orgId: input.orgId },
      include: {
        lines: true,
      },
    });
    if (!ro) throw new AppError("Repair order not found for posting.", 404);

    const relevantLines = ro.lines.filter((line) => line.decision !== "DECLINED");
    const labor = relevantLines
      .filter((line) => line.type === "LABOR")
      .reduce((sum, line) => sum + decimalToNumber(line.unitPrice) * decimalToNumber(line.quantity), 0);
    const parts = relevantLines
      .filter((line) => line.type === "PART")
      .reduce((sum, line) => sum + decimalToNumber(line.unitPrice) * decimalToNumber(line.quantity), 0);
    const fees = relevantLines
      .filter((line) => line.type === "FEE" || line.type === "SUBLET")
      .reduce((sum, line) => sum + decimalToNumber(line.unitPrice) * decimalToNumber(line.quantity), 0);

    const tax = decimalToNumber(ro.taxTotal);
    const total = labor + parts + fees + tax;
    const receivedPayment = !!input.paymentMethod;

    if (receivedPayment) {
      const payment = await tx.payment.create({
        data: {
          orgId: input.orgId,
          customerId: ro.customerId,
          amount: toDecimal(total),
          method: input.paymentMethod,
          reference: input.paymentReference ?? undefined,
          postedAt: new Date(),
          notes: `RO close payment ${ro.roNumber}`,
          createdById: input.actorId ?? undefined,
        },
      });
      await recordAudit(tx, {
        orgId: input.orgId,
        actorId: input.actorId,
        entityType: "Payment",
        entityId: payment.id,
        action: AuditAction.CREATE,
        after: payment,
      });
    }

    return postEntryFromDraft({
      tx,
      orgId: input.orgId,
      actorId: input.actorId,
      sourceType: JournalSourceType.RO_CLOSE,
      sourceId: ro.id,
      description: `RO Close ${ro.roNumber}`,
      postedAt: ro.closedAt ?? new Date(),
      lines: [
        {
          key: receivedPayment ? "cash" : "receivable",
          debit: total,
          description: `RO ${ro.roNumber} closing` ,
          entityType: "RepairOrder",
          entityId: ro.id,
        },
        ...(labor > 0
          ? [
              {
                key: "laborRevenue",
                credit: labor,
                description: `Labor revenue ${ro.roNumber}`,
                entityType: "RepairOrder",
                entityId: ro.id,
              },
            ]
          : []),
        ...(parts > 0
          ? [
              {
                key: "partsRevenue",
                credit: parts,
                description: `Parts revenue ${ro.roNumber}`,
                entityType: "RepairOrder",
                entityId: ro.id,
              },
            ]
          : []),
        ...(fees > 0
          ? [
              {
                key: "partsRevenue",
                credit: fees,
                description: `Service fees ${ro.roNumber}`,
                entityType: "RepairOrder",
                entityId: ro.id,
              },
            ]
          : []),
        ...(tax > 0
          ? [
              {
                key: "taxPayable",
                credit: tax,
                description: `Sales tax ${ro.roNumber}`,
                entityType: "RepairOrder",
                entityId: ro.id,
              },
            ]
          : []),
      ],
    });
  });
}

export async function postDealDelivery(input: { orgId: string; dealId: string; actorId?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const existingEntry = await tx.journalEntry.findFirst({
      where: {
        orgId: input.orgId,
        sourceType: JournalSourceType.DEAL_DELIVERY,
        sourceId: input.dealId,
      },
    });
    if (existingEntry) return existingEntry;

    const deal = await tx.deal.findFirst({ where: { id: input.dealId, orgId: input.orgId } });
    if (!deal) throw new AppError("Deal not found for posting.", 404);

    const salePrice = decimalToNumber(deal.salePrice);
    const taxes = decimalToNumber(deal.taxes);
    const total = salePrice + taxes;

    return postEntryFromDraft({
      tx,
      orgId: input.orgId,
      actorId: input.actorId,
      sourceType: JournalSourceType.DEAL_DELIVERY,
      sourceId: deal.id,
      description: `Deal delivery ${deal.dealNumber}`,
      postedAt: deal.deliveredAt ?? new Date(),
      lines: [
        {
          key: "receivable",
          debit: total,
          description: `Deal ${deal.dealNumber} receivable`,
          entityType: "Deal",
          entityId: deal.id,
        },
        {
          key: "salesRevenue",
          credit: salePrice,
          description: `Vehicle sale ${deal.dealNumber}`,
          entityType: "Deal",
          entityId: deal.id,
        },
        ...(taxes > 0
          ? [
              {
                key: "taxPayable",
                credit: taxes,
                description: `Deal tax ${deal.dealNumber}`,
                entityType: "Deal",
                entityId: deal.id,
              },
            ]
          : []),
      ],
    });
  });
}

export async function accountingReports() {
  const ctx = await requireOrgContext(Role.VIEWER);
  const now = Date.now();

  const [salesLog, inventoryAging, reconSpend] = await Promise.all([
    prisma.deal.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: true,
        vehicle: true,
      },
    }),
    prisma.vehicle.findMany({
      where: {
        orgId: ctx.orgId,
        status: { in: ["ACQUIRED", "RECON", "READY", "LISTED", "ON_HOLD"] },
      },
      select: {
        id: true,
        stockNumber: true,
        make: true,
        model: true,
        acquiredAt: true,
        status: true,
      },
      orderBy: { acquiredAt: "asc" },
    }),
    prisma.reconTask.findMany({
      where: { orgId: ctx.orgId },
      include: {
        lineItems: true,
        vehicle: true,
      },
    }),
  ]);

  const reconByVehicle = reconSpend.reduce<Record<string, { stockNumber: string; total: number }>>((acc, task) => {
    const lineTotal = task.lineItems.reduce((sum, line) => sum + Number(line.totalCost), 0);
    if (!acc[task.vehicleId]) {
      acc[task.vehicleId] = {
        stockNumber: task.vehicle.stockNumber,
        total: 0,
      };
    }
    acc[task.vehicleId].total += lineTotal;
    return acc;
  }, {});

  return {
    salesLog,
    inventoryAging: inventoryAging.map((row) => ({
      ...row,
      ageDays: Math.max(0, Math.round((now - new Date(row.acquiredAt).getTime()) / 86400000)),
    })),
    reconSpendSummary: Object.entries(reconByVehicle).map(([vehicleId, row]) => ({
      vehicleId,
      ...row,
    })),
  };
}

export async function accountingDeepReports() {
  const ctx = await requireOrgContext(Role.VIEWER);

  const [journalLines, ros, partTransactions, timePunches] = await Promise.all([
    prisma.journalLine.findMany({
      where: { orgId: ctx.orgId },
      include: { account: true, journalEntry: true },
    }),
    prisma.repairOrder.findMany({
      where: { orgId: ctx.orgId },
      include: { lines: true, advisor: true, customer: true, vehicle: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.partTransaction.findMany({
      where: { orgId: ctx.orgId },
      include: { part: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.timePunch.findMany({
      where: { orgId: ctx.orgId },
      include: { technician: true, repairOrder: true },
      orderBy: { clockInAt: "desc" },
      take: 300,
    }),
  ]);

  const trialBalanceMap = new Map<string, { accountCode: string; accountName: string; debit: number; credit: number }>();
  for (const line of journalLines) {
    const key = line.accountId;
    const row = trialBalanceMap.get(key) ?? {
      accountCode: line.account.code,
      accountName: line.account.name,
      debit: 0,
      credit: 0,
    };
    row.debit += Number(line.debit);
    row.credit += Number(line.credit);
    trialBalanceMap.set(key, row);
  }

  const trialBalance = Array.from(trialBalanceMap.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const incomeStatement = trialBalance.reduce(
    (acc, row) => {
      if (row.accountCode.startsWith("4")) {
        acc.revenue += row.credit - row.debit;
      }
      if (row.accountCode.startsWith("5") || row.accountCode.startsWith("6")) {
        acc.expense += row.debit - row.credit;
      }
      return acc;
    },
    { revenue: 0, expense: 0, netIncome: 0 },
  );
  incomeStatement.netIncome = incomeStatement.revenue - incomeStatement.expense;

  const roGross = ros.map((ro) => {
    const labor = ro.lines
      .filter((line) => line.type === "LABOR" && line.decision !== "DECLINED")
      .reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.quantity), 0);
    const parts = ro.lines
      .filter((line) => line.type === "PART" && line.decision !== "DECLINED")
      .reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.quantity), 0);
    const cost = ro.lines
      .filter((line) => line.decision !== "DECLINED")
      .reduce((sum, line) => sum + Number(line.unitCost) * Number(line.quantity), 0);
    const gross = labor + parts - cost;
    return {
      id: ro.id,
      roNumber: ro.roNumber,
      status: ro.status,
      labor,
      parts,
      cost,
      gross,
      customerName: `${ro.customer.firstName} ${ro.customer.lastName}`,
      vehicle: `${ro.vehicle.year} ${ro.vehicle.make} ${ro.vehicle.model}`,
    };
  });

  const partsGrossSummary = partTransactions.reduce(
    (acc, row) => {
      const value = Number(row.quantity) * Number(row.unitPrice);
      const cost = Number(row.quantity) * Number(row.unitCost);
      if (row.type === "CONSUME" || row.type === "ALLOCATE") {
        acc.revenue += Math.max(0, -value);
        acc.cost += Math.max(0, -cost);
      }
      return acc;
    },
    { revenue: 0, cost: 0, gross: 0 },
  );
  partsGrossSummary.gross = partsGrossSummary.revenue - partsGrossSummary.cost;

  const techProductivityMap = new Map<string, { technicianId: string; technicianName: string; clockedMinutes: number; flatHours: number }>();
  for (const punch of timePunches) {
    const row = techProductivityMap.get(punch.technicianId) ?? {
      technicianId: punch.technicianId,
      technicianName: punch.technician.displayName,
      clockedMinutes: 0,
      flatHours: 0,
    };
    row.clockedMinutes += punch.minutesWorked;
    techProductivityMap.set(punch.technicianId, row);
  }

  const roLines = await prisma.repairOrderLine.findMany({
    where: { orgId: ctx.orgId, technicianId: { not: null } },
  });
  for (const line of roLines) {
    const techId = line.technicianId;
    if (!techId) continue;
    const row = techProductivityMap.get(techId);
    if (!row) continue;
    row.flatHours += Number(line.flatRateHours);
  }

  const technicianProductivity = Array.from(techProductivityMap.values()).map((row) => ({
    ...row,
    clockedHours: row.clockedMinutes / 60,
    efficiency:
      row.clockedMinutes <= 0
        ? 0
        : Number(((row.flatHours / (row.clockedMinutes / 60)) * 100).toFixed(1)),
  }));

  return {
    trialBalance,
    incomeStatement,
    roGross,
    partsGrossSummary,
    technicianProductivity,
  };
}
