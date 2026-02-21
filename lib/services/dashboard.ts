import { subDays } from "date-fns";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/services/guard";

export async function getDashboardData() {
  const ctx = await requireOrgContext(Role.VIEWER);
  const now = new Date();
  const last30 = subDays(now, 30);
  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { taskOverdueGraceMinutes: true },
  });
  const overdueCutoff = new Date(now.getTime() - (org?.taskOverdueGraceMinutes ?? 0) * 60 * 1000);

  const [
    leadsAtRisk,
    appointmentsToday,
    serviceApprovals,
    dealsInProgress,
    fundingPending,
    inventoryAlerts,
    kpiUnits,
    kpiGross,
    reconAging,
    leadResponseTimes,
    overdueTasks,
    pendingApprovals,
  ] = await Promise.all([
    prisma.lead.findMany({
      where: {
        orgId: ctx.orgId,
        slaDueAt: { lte: now },
        firstResponseAt: null,
        stage: { in: ["NEW", "CONTACTED", "QUALIFIED", "APPOINTMENT_SET"] },
      },
      include: { customer: true },
      orderBy: { slaDueAt: "asc" },
      take: 8,
    }),
    prisma.appointment.findMany({
      where: {
        orgId: ctx.orgId,
        scheduledAt: {
          gte: new Date(now.toDateString()),
          lte: new Date(new Date(now.toDateString()).getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        customer: true,
        lead: true,
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.repairOrder.findMany({
      where: {
        orgId: ctx.orgId,
        status: "AWAITING_APPROVAL",
      },
      include: {
        customer: true,
        vehicle: true,
      },
      orderBy: { approvalRequestedAt: "asc" },
      take: 8,
    }),
    prisma.deal.findMany({
      where: {
        orgId: ctx.orgId,
        stage: { in: ["DRAFT", "SUBMITTED", "APPROVED", "CONTRACTED"] },
      },
      include: {
        customer: true,
        vehicle: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.deal.findMany({
      where: {
        orgId: ctx.orgId,
        fundingStatus: { in: ["PENDING", "IN_REVIEW", "HOLD"] },
      },
      include: {
        customer: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.vehicle.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [
          { status: "RECON" },
          { status: "ACQUIRED" },
          { status: "ON_HOLD" },
        ],
      },
      orderBy: { acquiredAt: "asc" },
      take: 10,
    }),
    prisma.deal.groupBy({
      by: ["createdAt"],
      where: {
        orgId: ctx.orgId,
        createdAt: { gte: last30 },
      },
      _count: { id: true },
    }),
    prisma.deal.findMany({
      where: {
        orgId: ctx.orgId,
        createdAt: { gte: last30 },
      },
      select: {
        salePrice: true,
        financedAmount: true,
      },
    }),
    prisma.vehicle.findMany({
      where: {
        orgId: ctx.orgId,
        status: "RECON",
      },
      select: {
        id: true,
        acquiredAt: true,
      },
    }),
    prisma.lead.findMany({
      where: {
        orgId: ctx.orgId,
        createdAt: { gte: last30 },
        firstResponseAt: { not: null },
      },
      select: {
        createdAt: true,
        firstResponseAt: true,
      },
      take: 100,
    }),
    prisma.crmTask.findMany({
      where: {
        orgId: ctx.orgId,
        status: "OPEN",
        dueAt: { lte: overdueCutoff },
      },
      include: {
        lead: true,
        customer: true,
        assignedTo: true,
      },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
    prisma.discountApprovalRequest.findMany({
      where: {
        orgId: ctx.orgId,
        status: "PENDING",
      },
      include: {
        quote: true,
        requestedBy: true,
      },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
  ]);

  const unitsByDay = kpiUnits.reduce<Record<string, number>>((acc, row) => {
    const key = row.createdAt.toISOString().split("T")[0];
    acc[key] = (acc[key] ?? 0) + row._count.id;
    return acc;
  }, {});

  const totalGross = kpiGross.reduce((sum, deal) => sum + (Number(deal.salePrice) - Number(deal.financedAmount)), 0);
  const avgReconAge =
    reconAging.length === 0
      ? 0
      : reconAging.reduce((sum, vehicle) => sum + (now.getTime() - vehicle.acquiredAt.getTime()) / 86400000, 0) / reconAging.length;
  const avgLeadResponseHours =
    leadResponseTimes.length === 0
      ? 0
      : leadResponseTimes.reduce(
          (sum, lead) => sum + ((lead.firstResponseAt?.getTime() ?? lead.createdAt.getTime()) - lead.createdAt.getTime()) / 3_600_000,
          0,
        ) / leadResponseTimes.length;

  return {
    leadsAtRisk,
    appointmentsToday,
    serviceApprovals,
    dealsInProgress,
    fundingPending,
    overdueTasks,
    pendingApprovals,
    inventoryAlerts,
    kpis: {
      units30: kpiGross.length,
      gross30: totalGross,
      avgReconAge,
      avgLeadResponseHours,
      unitsByDay,
    },
  };
}
