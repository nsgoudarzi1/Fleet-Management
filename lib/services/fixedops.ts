import { AuditAction, PermissionScope, Role, type PartTransactionType, type RepairOrderLineDecision } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { postRepairOrderClose } from "@/lib/services/accounting";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext, requireOrgRoles, requirePerm } from "@/lib/services/guard";
import { emitWebhookEvent } from "@/lib/services/integrations";
import {
  convertAppointmentToRoSchema,
  partAdjustSchema,
  partAllocateSchema,
  partCreateSchema,
  partReceiveSchema,
  repairOrderCreateSchema,
  repairOrderLineCreateSchema,
  repairOrderLineDecisionSchema,
  repairOrderStatusTransitionSchema,
  serviceAppointmentCreateSchema,
} from "@/lib/validations/fixedops";

type ListFilters = {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

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

async function recalcRepairOrderTotals(repairOrderId: string, orgId: string) {
  const [org, lines] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
    prisma.repairOrderLine.findMany({
      where: { orgId, repairOrderId },
    }),
  ]);

  const active = lines.filter((line) => line.decision !== "DECLINED");
  const subtotalLabor = active
    .filter((line) => line.type === "LABOR")
    .reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.quantity), 0);
  const subtotalParts = active
    .filter((line) => line.type === "PART")
    .reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.quantity), 0);
  const subtotalSublet = active
    .filter((line) => line.type === "SUBLET")
    .reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.quantity), 0);
  const subtotalFees = active
    .filter((line) => line.type === "FEE")
    .reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.quantity), 0);

  const taxableBase = active
    .filter((line) => line.taxable)
    .reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.quantity), 0);
  const taxTotal = taxableBase * Number(org.taxRate);
  const grandTotal = subtotalLabor + subtotalParts + subtotalSublet + subtotalFees + taxTotal;

  return prisma.repairOrder.update({
    where: { id: repairOrderId },
    data: {
      subtotalLabor,
      subtotalParts,
      subtotalSublet,
      subtotalFees,
      taxTotal,
      grandTotal,
    },
  });
}

export async function fixedOpsWorkQueue() {
  const ctx = await requireOrgContext(Role.VIEWER);
  const now = Date.now();
  const threeDaysAgo = new Date(now - 1000 * 60 * 60 * 24 * 3);

  const [waitingApprovals, agingRos, techClockedIn, partsToPick] = await Promise.all([
    prisma.repairOrder.findMany({
      where: { orgId: ctx.orgId, status: "AWAITING_APPROVAL" },
      include: { customer: true, vehicle: true },
      orderBy: { approvalRequestedAt: "asc" },
      take: 10,
    }),
    prisma.repairOrder.findMany({
      where: {
        orgId: ctx.orgId,
        status: { in: ["OPEN", "IN_PROGRESS", "AWAITING_APPROVAL", "COMPLETED"] },
        createdAt: { lte: threeDaysAgo },
      },
      include: { customer: true, vehicle: true },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    prisma.timePunch.findMany({
      where: { orgId: ctx.orgId, clockOutAt: null },
      include: { technician: true, repairOrder: true },
      orderBy: { clockInAt: "asc" },
      take: 20,
    }),
    prisma.repairOrderLine.findMany({
      where: {
        orgId: ctx.orgId,
        type: "PART",
        decision: { in: ["APPROVED", "RECOMMENDED"] },
        partId: { not: null },
        repairOrder: {
          status: { in: ["OPEN", "IN_PROGRESS", "AWAITING_APPROVAL"] },
        },
      },
      include: {
        repairOrder: true,
        part: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  ]);

  return {
    waitingApprovals,
    agingRos,
    techClockedIn,
    partsToPick,
  };
}

export async function listServiceAppointments(filters: ListFilters = {}) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(10, Math.min(100, filters.pageSize ?? 25));

  const where = {
    orgId: ctx.orgId,
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.query
      ? {
          OR: [
            { title: { contains: filters.query, mode: "insensitive" as const } },
            { concern: { contains: filters.query, mode: "insensitive" as const } },
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
    prisma.serviceAppointment.findMany({
      where,
      include: {
        customer: true,
        vehicle: true,
        technician: true,
        repairOrder: true,
      },
      orderBy: { scheduledAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.serviceAppointment.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function createServiceAppointment(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = serviceAppointmentCreateSchema.parse(input);

  if (parsed.customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: parsed.customerId, orgId: ctx.orgId } });
    if (!customer) throw new AppError("Customer not found.", 404);
  }

  if (parsed.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: parsed.vehicleId, orgId: ctx.orgId } });
    if (!vehicle) throw new AppError("Vehicle not found.", 404);
  }

  const appointment = await prisma.serviceAppointment.create({
    data: {
      orgId: ctx.orgId,
      customerId: parsed.customerId,
      vehicleId: parsed.vehicleId,
      technicianId: parsed.technicianId,
      title: parsed.title,
      concern: parsed.concern,
      scheduledAt: new Date(parsed.scheduledAt),
      status: parsed.status,
      notes: parsed.notes,
      createdById: ctx.userId,
    },
    include: {
      customer: true,
      vehicle: true,
      technician: true,
    },
  });

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ServiceAppointment",
      entityId: appointment.id,
      action: AuditAction.CREATE,
      after: appointment,
    });
  });

  return appointment;
}

export async function convertAppointmentToRepairOrder(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = convertAppointmentToRoSchema.parse(input);

  const appointment = await prisma.serviceAppointment.findFirst({
    where: { id: parsed.appointmentId, orgId: ctx.orgId },
    include: { customer: true, vehicle: true },
  });
  if (!appointment) throw new AppError("Appointment not found.", 404);
  if (appointment.convertedToRoId) {
    const existingRo = await prisma.repairOrder.findFirst({ where: { id: appointment.convertedToRoId, orgId: ctx.orgId } });
    if (existingRo) return existingRo;
  }

  const customerId = parsed.customerId ?? appointment.customerId;
  const vehicleId = parsed.vehicleId ?? appointment.vehicleId;
  if (!customerId || !vehicleId) {
    throw new AppError("Appointment must be linked to both customer and vehicle before conversion.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const ro = await tx.repairOrder.create({
      data: {
        orgId: ctx.orgId,
        roNumber: await nextRoNumber(ctx.orgId),
        customerId,
        vehicleId,
        advisorId: parsed.advisorId ?? ctx.userId,
        serviceAppointmentId: appointment.id,
        customerNotes: parsed.customerNotes ?? appointment.concern,
        internalNotes: parsed.internalNotes ?? appointment.notes,
        status: "OPEN",
      },
      include: {
        customer: true,
        vehicle: true,
      },
    });

    await tx.serviceAppointment.update({
      where: { id: appointment.id },
      data: {
        convertedToRoId: ro.id,
        status: "IN_PROGRESS",
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "RepairOrder",
      entityId: ro.id,
      action: AuditAction.CREATE,
      after: ro,
    });

    await emitWebhookEvent({
      orgId: ctx.orgId,
      eventType: "repairOrder.created",
      entityType: "RepairOrder",
      entityId: ro.id,
      payload: {
        roNumber: ro.roNumber,
        status: ro.status,
        customerId: ro.customerId,
        vehicleId: ro.vehicleId,
      },
    });

    return ro;
  });
}

export async function listRepairOrders(filters: ListFilters = {}) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(10, Math.min(100, filters.pageSize ?? 25));

  const where = {
    orgId: ctx.orgId,
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.query
      ? {
          OR: [
            { roNumber: { contains: filters.query, mode: "insensitive" as const } },
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
    prisma.repairOrder.findMany({
      where,
      include: {
        customer: true,
        vehicle: true,
        advisor: true,
        lines: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.repairOrder.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getRepairOrderDetail(repairOrderId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const repairOrder = await prisma.repairOrder.findFirst({
    where: { id: repairOrderId, orgId: ctx.orgId },
    include: {
      customer: true,
      vehicle: true,
      advisor: true,
      appointment: true,
      lines: {
        include: {
          part: true,
          technician: true,
          approvedBy: true,
        },
        orderBy: { lineNumber: "asc" },
      },
      timePunches: {
        include: {
          technician: true,
        },
        orderBy: { clockInAt: "desc" },
      },
      partTransactions: {
        include: {
          part: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!repairOrder) throw new AppError("Repair order not found.", 404);
  return repairOrder;
}

export async function createRepairOrder(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = repairOrderCreateSchema.parse(input);

  const [customer, vehicle] = await Promise.all([
    prisma.customer.findFirst({ where: { id: parsed.customerId, orgId: ctx.orgId } }),
    prisma.vehicle.findFirst({ where: { id: parsed.vehicleId, orgId: ctx.orgId } }),
  ]);
  if (!customer) throw new AppError("Customer not found.", 404);
  if (!vehicle) throw new AppError("Vehicle not found.", 404);

  const ro = await prisma.$transaction(async (tx) => {
    const created = await tx.repairOrder.create({
      data: {
        orgId: ctx.orgId,
        roNumber: await nextRoNumber(ctx.orgId),
        customerId: parsed.customerId,
        vehicleId: parsed.vehicleId,
        advisorId: parsed.advisorId ?? ctx.userId,
        serviceAppointmentId: parsed.serviceAppointmentId,
        customerNotes: parsed.customerNotes,
        internalNotes: parsed.internalNotes,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "RepairOrder",
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });

    return created;
  });

  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "repairOrder.created",
    entityType: "RepairOrder",
    entityId: ro.id,
    payload: {
      roNumber: ro.roNumber,
      status: ro.status,
      customerId: ro.customerId,
      vehicleId: ro.vehicleId,
    },
  });

  return ro;
}

export async function addRepairOrderLine(repairOrderId: string, input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = repairOrderLineCreateSchema.parse(input);

  const repairOrder = await prisma.repairOrder.findFirst({
    where: { id: repairOrderId, orgId: ctx.orgId },
  });
  if (!repairOrder) throw new AppError("Repair order not found.", 404);

  if (parsed.partId) {
    const part = await prisma.part.findFirst({ where: { id: parsed.partId, orgId: ctx.orgId } });
    if (!part) throw new AppError("Part not found.", 404);
  }

  const line = await prisma.$transaction(async (tx) => {
    const maxLine = await tx.repairOrderLine.findFirst({
      where: { orgId: ctx.orgId, repairOrderId },
      orderBy: { lineNumber: "desc" },
      select: { lineNumber: true },
    });

    const created = await tx.repairOrderLine.create({
      data: {
        orgId: ctx.orgId,
        repairOrderId,
        lineNumber: (maxLine?.lineNumber ?? 0) + 1,
        type: parsed.type,
        description: parsed.description,
        operationCode: parsed.operationCode,
        partId: parsed.partId,
        technicianId: parsed.technicianId,
        quantity: parsed.quantity,
        flatRateHours: parsed.flatRateHours,
        actualHours: parsed.actualHours,
        unitCost: parsed.unitCost,
        unitPrice: parsed.unitPrice,
        taxable: parsed.taxable,
        decision: parsed.decision,
        notes: parsed.notes,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "RepairOrderLine",
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });

    return created;
  });

  await recalcRepairOrderTotals(repairOrderId, ctx.orgId);
  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "repairOrder.updated",
    entityType: "RepairOrder",
    entityId: repairOrderId,
    payload: { reason: "line_added", lineId: line.id },
  });

  return line;
}

export async function updateRepairOrderLineDecision(repairOrderId: string, input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = repairOrderLineDecisionSchema.parse(input);

  const existing = await prisma.repairOrderLine.findFirst({
    where: {
      id: parsed.lineId,
      orgId: ctx.orgId,
      repairOrderId,
    },
  });
  if (!existing) throw new AppError("Repair order line not found.", 404);

  const updateData: {
    decision: RepairOrderLineDecision;
    approvedAt?: Date | null;
    approvedById?: string | null;
  } = {
    decision: parsed.decision,
  };
  if (parsed.decision === "APPROVED") {
    updateData.approvedAt = new Date();
    updateData.approvedById = ctx.userId;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.repairOrderLine.update({
      where: { id: parsed.lineId },
      data: updateData,
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "RepairOrderLine",
      entityId: row.id,
      action: AuditAction.UPDATE,
      before: existing,
      after: row,
    });
    return row;
  });

  await recalcRepairOrderTotals(repairOrderId, ctx.orgId);
  return updated;
}

export async function transitionRepairOrderStatus(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = repairOrderStatusTransitionSchema.parse(input);

  const existing = await prisma.repairOrder.findFirst({
    where: { id: parsed.repairOrderId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Repair order not found.", 404);

  if (parsed.status === "CLOSED_INVOICED") {
    const canClose = ctx.role === Role.OWNER || ctx.permissions.includes(PermissionScope.FIXEDOPS_CLOSE);
    if (!canClose) {
      throw new AppError("Only authorized users can close and invoice repair orders.", 403);
    }
    await requirePerm(PermissionScope.FIXEDOPS_CLOSE);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.repairOrder.update({
      where: { id: parsed.repairOrderId },
      data: {
        status: parsed.status,
        approvalRequestedAt: parsed.status === "AWAITING_APPROVAL" ? new Date() : existing.approvalRequestedAt,
        approvedAt: parsed.status === "IN_PROGRESS" && existing.status === "AWAITING_APPROVAL" ? new Date() : existing.approvedAt,
        approvedById: parsed.status === "IN_PROGRESS" && existing.status === "AWAITING_APPROVAL" ? ctx.userId : existing.approvedById,
        completedAt: parsed.status === "COMPLETED" ? new Date() : existing.completedAt,
        closedAt: parsed.status === "CLOSED_INVOICED" ? new Date() : existing.closedAt,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "RepairOrder",
      entityId: parsed.repairOrderId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });

    return updated;
  });

  await recalcRepairOrderTotals(parsed.repairOrderId, ctx.orgId);

  if (parsed.status === "CLOSED_INVOICED") {
    await postRepairOrderClose({
      orgId: ctx.orgId,
      repairOrderId: parsed.repairOrderId,
      actorId: ctx.userId,
      paymentMethod: parsed.paymentMethod,
      paymentReference: parsed.paymentReference,
    });

    await emitWebhookEvent({
      orgId: ctx.orgId,
      eventType: "repairOrder.closed",
      entityType: "RepairOrder",
      entityId: parsed.repairOrderId,
      payload: {
        status: parsed.status,
      },
    });
  } else {
    await emitWebhookEvent({
      orgId: ctx.orgId,
      eventType: "repairOrder.updated",
      entityType: "RepairOrder",
      entityId: parsed.repairOrderId,
      payload: {
        status: parsed.status,
      },
    });
  }

  return result;
}

export async function listParts(filters: ListFilters = {}) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(10, Math.min(100, filters.pageSize ?? 25));

  const where = {
    orgId: ctx.orgId,
    ...(filters.query
      ? {
          OR: [
            { partNumber: { contains: filters.query, mode: "insensitive" as const } },
            { description: { contains: filters.query, mode: "insensitive" as const } },
            { binLocation: { contains: filters.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.part.findMany({
      where,
      include: {
        vendor: true,
      },
      orderBy: [{ description: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.part.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getPartDetail(partId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const part = await prisma.part.findFirst({
    where: { id: partId, orgId: ctx.orgId },
    include: {
      vendor: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      repairLines: {
        include: {
          repairOrder: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!part) throw new AppError("Part not found.", 404);
  return part;
}

export async function createPart(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = partCreateSchema.parse(input);

  const part = await prisma.$transaction(async (tx) => {
    const created = await tx.part.create({
      data: {
        orgId: ctx.orgId,
        vendorId: parsed.vendorId,
        partNumber: parsed.partNumber,
        description: parsed.description,
        binLocation: parsed.binLocation,
        reorderPoint: parsed.reorderPoint,
        unitCost: parsed.unitCost,
        unitPrice: parsed.unitPrice,
        taxable: parsed.taxable,
        allowNegative: parsed.allowNegative,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Part",
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });

    return created;
  });

  return part;
}

async function createPartTransaction(input: {
  orgId: string;
  userId?: string | null;
  partId: string;
  type: PartTransactionType;
  quantity: number;
  unitCost?: number;
  unitPrice?: number;
  reason?: string | null;
  reference?: string | null;
  repairOrderId?: string | null;
  lineId?: string | null;
}) {
  const part = await prisma.part.findFirst({ where: { id: input.partId, orgId: input.orgId } });
  if (!part) throw new AppError("Part not found.", 404);

  const onHand = Number(part.onHandQty);
  const reserved = Number(part.reservedQty);
  const nextOnHand = onHand + input.quantity;

  if (nextOnHand < 0 && !part.allowNegative) {
    throw new AppError(`Insufficient inventory for part ${part.partNumber}.`, 400);
  }

  const nextReserved = reserved;

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.partTransaction.create({
      data: {
        orgId: input.orgId,
        partId: input.partId,
        type: input.type,
        quantity: input.quantity,
        unitCost: input.unitCost ?? Number(part.unitCost),
        unitPrice: input.unitPrice ?? Number(part.unitPrice),
        reason: input.reason,
        reference: input.reference,
        repairOrderId: input.repairOrderId ?? undefined,
        lineId: input.lineId ?? undefined,
        createdById: input.userId ?? undefined,
      },
    });

    const updatedPart = await tx.part.update({
      where: { id: part.id },
      data: {
        onHandQty: nextOnHand,
        reservedQty: nextReserved,
        unitCost: input.unitCost ?? undefined,
      },
    });

    await recordAudit(tx, {
      orgId: input.orgId,
      actorId: input.userId,
      entityType: "PartTransaction",
      entityId: transaction.id,
      action: AuditAction.CREATE,
      after: transaction,
    });

    await recordAudit(tx, {
      orgId: input.orgId,
      actorId: input.userId,
      entityType: "Part",
      entityId: part.id,
      action: AuditAction.UPDATE,
      before: part,
      after: updatedPart,
    });

    return { transaction, updatedPart };
  });
}

export async function receiveParts(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = partReceiveSchema.parse(input);
  const result = await createPartTransaction({
    orgId: ctx.orgId,
    userId: ctx.userId,
    partId: parsed.partId,
    type: "RECEIVE",
    quantity: parsed.quantity,
    unitCost: parsed.unitCost,
    reason: parsed.reason,
    reference: parsed.reference,
  });

  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "part.transaction.created",
    entityType: "PartTransaction",
    entityId: result.transaction.id,
    payload: {
      type: result.transaction.type,
      partId: result.transaction.partId,
      quantity: Number(result.transaction.quantity),
      reference: result.transaction.reference,
    },
  });

  return result;
}

export async function adjustPartInventory(input: unknown) {
  const ctx = await requireOrgRoles([Role.SERVICE, Role.MANAGER, Role.ACCOUNTING]);
  const parsed = partAdjustSchema.parse(input);
  if (parsed.quantityDelta === 0) throw new AppError("Adjustment quantity cannot be zero.", 400);

  const result = await createPartTransaction({
    orgId: ctx.orgId,
    userId: ctx.userId,
    partId: parsed.partId,
    type: "ADJUST",
    quantity: parsed.quantityDelta,
    reason: parsed.reason,
    reference: parsed.reference,
  });

  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "part.transaction.created",
    entityType: "PartTransaction",
    entityId: result.transaction.id,
    payload: {
      type: result.transaction.type,
      partId: result.transaction.partId,
      quantity: Number(result.transaction.quantity),
      reference: result.transaction.reference,
      reason: result.transaction.reason,
    },
  });

  return result;
}

export async function allocatePartToRepairOrder(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = partAllocateSchema.parse(input);

  const [part, repairOrder] = await Promise.all([
    prisma.part.findFirst({ where: { id: parsed.partId, orgId: ctx.orgId } }),
    prisma.repairOrder.findFirst({ where: { id: parsed.repairOrderId, orgId: ctx.orgId } }),
  ]);
  if (!part) throw new AppError("Part not found.", 404);
  if (!repairOrder) throw new AppError("Repair order not found.", 404);

  const available = Number(part.onHandQty) - Number(part.reservedQty);
  if (available < parsed.quantity && !parsed.allowOverride && !part.allowNegative) {
    throw new AppError(`Insufficient available quantity. Available: ${available}.`, 400);
  }

  const result = await createPartTransaction({
    orgId: ctx.orgId,
    userId: ctx.userId,
    partId: parsed.partId,
    repairOrderId: parsed.repairOrderId,
    lineId: parsed.lineId,
    type: "ALLOCATE",
    quantity: -Math.abs(parsed.quantity),
    unitCost: Number(part.unitCost),
    unitPrice: Number(part.unitPrice),
    reason: parsed.reason ?? "RO allocation",
    reference: parsed.reference ?? repairOrder.roNumber,
  });

  await emitWebhookEvent({
    orgId: ctx.orgId,
    eventType: "part.transaction.created",
    entityType: "PartTransaction",
    entityId: result.transaction.id,
    payload: {
      type: result.transaction.type,
      partId: result.transaction.partId,
      quantity: Number(result.transaction.quantity),
      repairOrderId: parsed.repairOrderId,
      lineId: parsed.lineId,
    },
  });

  return result;
}

export async function listTechnicians() {
  const ctx = await requireOrgContext(Role.VIEWER);
  return prisma.technician.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
  });
}

export async function listPartVendors() {
  const ctx = await requireOrgContext(Role.VIEWER);
  return prisma.partVendor.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: "asc" },
  });
}
