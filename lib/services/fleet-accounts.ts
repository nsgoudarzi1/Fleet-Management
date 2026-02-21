import { AuditAction, Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requireOrgContext } from "@/lib/services/guard";
import {
  fleetAccountCreateSchema,
  fleetAccountListSchema,
  fleetAccountUpdateSchema,
} from "@/lib/validations/fleet";

export async function listFleetAccounts(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const input = fleetAccountListSchema.parse(rawInput ?? {});
  const where = {
    orgId: ctx.orgId,
    ...(input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: "insensitive" as const } },
            { notes: { contains: input.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.fleetAccount.findMany({
      where,
      include: {
        memberships: {
          include: {
            customer: true,
          },
        },
        quotes: {
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.fleetAccount.count({ where }),
  ]);

  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function getFleetAccountDetail(fleetAccountId: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const account = await prisma.fleetAccount.findFirst({
    where: { id: fleetAccountId, orgId: ctx.orgId },
    include: {
      memberships: {
        include: {
          customer: true,
        },
        orderBy: { createdAt: "asc" },
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        take: 25,
      },
    },
  });
  if (!account) throw new AppError("Fleet account not found.", 404);
  return account;
}

export async function createFleetAccount(rawInput: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const input = fleetAccountCreateSchema.parse(rawInput);

  const customers = input.customerIds.length
    ? await prisma.customer.findMany({
        where: {
          orgId: ctx.orgId,
          id: { in: input.customerIds },
        },
        select: { id: true },
      })
    : [];
  if (customers.length !== input.customerIds.length) {
    throw new AppError("One or more selected customers do not belong to this organization.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.fleetAccount.create({
      data: {
        orgId: ctx.orgId,
        name: input.name,
        locationsJson: input.locations,
        billingTerms: input.billingTerms,
        taxExempt: input.taxExempt,
        notes: input.notes,
        memberships: {
          create: input.customerIds.map((customerId) => ({
            orgId: ctx.orgId,
            customerId,
          })),
        },
      },
      include: {
        memberships: true,
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "FleetAccount",
      entityId: account.id,
      action: AuditAction.CREATE,
      after: account,
    });

    return account;
  });
}

export async function updateFleetAccount(fleetAccountId: string, rawInput: unknown) {
  const ctx = await requireOrgContext(Role.MANAGER);
  const input = fleetAccountUpdateSchema.parse(rawInput);

  const existing = await prisma.fleetAccount.findFirst({
    where: { id: fleetAccountId, orgId: ctx.orgId },
    include: {
      memberships: true,
    },
  });
  if (!existing) throw new AppError("Fleet account not found.", 404);

  const customerIds = input.customerIds;
  if (customerIds) {
    const customers = await prisma.customer.findMany({
      where: { orgId: ctx.orgId, id: { in: customerIds } },
      select: { id: true },
    });
    if (customers.length !== customerIds.length) {
      throw new AppError("One or more selected customers do not belong to this organization.", 400);
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fleetAccount.update({
      where: { id: fleetAccountId },
      data: {
        name: input.name,
        billingTerms: input.billingTerms,
        taxExempt: input.taxExempt,
        notes: input.notes,
        ...(input.locations ? { locationsJson: input.locations } : {}),
      },
    });

    if (customerIds) {
      await tx.fleetAccountCustomer.deleteMany({
        where: { orgId: ctx.orgId, fleetAccountId },
      });
      if (customerIds.length) {
        await tx.fleetAccountCustomer.createMany({
          data: customerIds.map((customerId) => ({
            orgId: ctx.orgId,
            fleetAccountId,
            customerId,
          })),
        });
      }
    }

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "FleetAccount",
      entityId: fleetAccountId,
      action: AuditAction.UPDATE,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
