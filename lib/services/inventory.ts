import { AuditAction, Role, type ReconTaskStatus, type VehicleStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext } from "@/lib/services/guard";
import {
  reconLineItemSchema,
  reconTaskCreateSchema,
  reconTaskStatusSchema,
  vehicleCreateSchema,
  vehicleStatusBulkSchema,
  vehicleUpdateSchema,
} from "@/lib/validations/inventory";

type VehicleFilters = {
  query?: string;
  status?: VehicleStatus;
  page?: number;
  pageSize?: number;
};

export async function listVehicles(filters: VehicleFilters) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const where = {
    orgId: ctx.orgId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.query
      ? {
          OR: [
            { vin: { contains: filters.query, mode: "insensitive" as const } },
            { stockNumber: { contains: filters.query, mode: "insensitive" as const } },
            { make: { contains: filters.query, mode: "insensitive" as const } },
            { model: { contains: filters.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.vehicle.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        reconTasks: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getVehicleDetail(vehicleId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      orgId: ctx.orgId,
    },
    include: {
      photos: {
        orderBy: { sortOrder: "asc" },
      },
      reconTasks: {
        include: {
          vendor: true,
          lineItems: true,
        },
        orderBy: [{ createdAt: "desc" }],
      },
      priceHistory: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      deals: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
  if (!vehicle) {
    throw new AppError("Vehicle not found.", 404);
  }
  return vehicle;
}

export async function createVehicle(input: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = vehicleCreateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.create({
      data: {
        orgId: ctx.orgId,
        vin: parsed.vin.toUpperCase(),
        stockNumber: parsed.stockNumber.toUpperCase(),
        year: parsed.year,
        make: parsed.make,
        model: parsed.model,
        trim: parsed.trim,
        mileage: parsed.mileage,
        purchaseSource: parsed.purchaseSource,
        listPrice: parsed.listPrice,
        minPrice: parsed.minPrice,
        floorplanSource: parsed.floorplanSource,
        location: parsed.location,
        status: parsed.status,
      },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Vehicle",
      entityId: vehicle.id,
      action: AuditAction.CREATE,
      after: vehicle,
    });
    return vehicle;
  });
}

export async function updateVehicle(vehicleId: string, input: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = vehicleUpdateSchema.parse(input);
  const existing = await prisma.vehicle.findFirst({
    where: { id: vehicleId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Vehicle not found.", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...parsed,
        vin: parsed.vin?.toUpperCase(),
        stockNumber: parsed.stockNumber?.toUpperCase(),
      },
    });

    if (typeof parsed.listPrice === "number" && Number(existing.listPrice) !== parsed.listPrice) {
      await tx.vehiclePriceHistory.create({
        data: {
          orgId: ctx.orgId,
          vehicleId,
          previous: existing.listPrice,
          next: parsed.listPrice,
          createdById: ctx.userId,
          note: "Inline update",
        },
      });
    }

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Vehicle",
      entityId: vehicleId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function bulkUpdateVehicleStatus(input: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const parsed = vehicleStatusBulkSchema.parse(input);

  const vehicles = await prisma.vehicle.findMany({
    where: {
      orgId: ctx.orgId,
      id: { in: parsed.vehicleIds },
    },
  });

  return prisma.$transaction(async (tx) => {
    const results = await Promise.all(
      vehicles.map(async (vehicle) => {
        const updated = await tx.vehicle.update({
          where: { id: vehicle.id },
          data: { status: parsed.status },
        });
        await recordAudit(tx, {
          orgId: ctx.orgId,
          actorId: ctx.userId,
          entityType: "Vehicle",
          entityId: vehicle.id,
          action: AuditAction.UPDATE,
          before: vehicle,
          after: updated,
        });
        return updated;
      }),
    );
    return results.length;
  });
}

export async function createReconTask(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = reconTaskCreateSchema.parse(input);
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: parsed.vehicleId,
      orgId: ctx.orgId,
    },
  });
  if (!vehicle) throw new AppError("Vehicle not found.", 404);

  return prisma.reconTask.create({
    data: {
      orgId: ctx.orgId,
      vehicleId: parsed.vehicleId,
      vendorId: parsed.vendorId,
      title: parsed.title,
      notes: parsed.notes,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
    },
  });
}

export async function setReconTaskStatus(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = reconTaskStatusSchema.parse(input);

  const task = await prisma.reconTask.findFirst({
    where: {
      id: parsed.reconTaskId,
      orgId: ctx.orgId,
    },
  });
  if (!task) throw new AppError("Recon task not found.", 404);

  return prisma.reconTask.update({
    where: { id: parsed.reconTaskId },
    data: {
      status: parsed.status as ReconTaskStatus,
      completedAt: parsed.status === "DONE" ? new Date() : null,
    },
  });
}

export async function addReconLineItem(input: unknown) {
  const ctx = await requireOrgContext(Role.SERVICE);
  const parsed = reconLineItemSchema.parse(input);
  const task = await prisma.reconTask.findFirst({
    where: { id: parsed.reconTaskId, orgId: ctx.orgId },
  });
  if (!task) throw new AppError("Recon task not found.", 404);

  const totalCost = parsed.quantity * parsed.unitCost;
  return prisma.$transaction(async (tx) => {
    const item = await tx.reconLineItem.create({
      data: {
        orgId: ctx.orgId,
        reconTaskId: parsed.reconTaskId,
        category: parsed.category,
        description: parsed.description,
        quantity: parsed.quantity,
        unitCost: parsed.unitCost,
        totalCost,
      },
    });

    const allItems = await tx.reconLineItem.findMany({
      where: { reconTaskId: parsed.reconTaskId, orgId: ctx.orgId },
    });
    const reconSpend = allItems.reduce((sum, lineItem) => sum + Number(lineItem.totalCost), 0);
    await tx.vehicle.update({
      where: { id: task.vehicleId },
      data: {
        costParts: reconSpend,
      },
    });
    return item;
  });
}

export async function deleteVehicle(vehicleId: string) {
  const ctx = await requireOrgContext(Role.ADMIN);
  const existing = await prisma.vehicle.findFirst({
    where: { id: vehicleId, orgId: ctx.orgId },
  });
  if (!existing) throw new AppError("Vehicle not found.", 404);

  await prisma.$transaction(async (tx) => {
    await tx.vehicle.delete({
      where: { id: vehicleId },
    });
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Vehicle",
      entityId: vehicleId,
      action: AuditAction.DELETE,
      before: existing,
    });
  });
}
