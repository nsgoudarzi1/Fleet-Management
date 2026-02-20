import { AuditAction, PermissionScope, Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { AppError, requirePerm } from "@/lib/services/guard";
import { ALL_PERMISSION_SCOPES, permissionsForBuiltinRole } from "@/lib/services/permissions";
import {
  auditFilterSchema,
  customRoleCreateSchema,
  customRoleUpdateSchema,
  membershipRoleUpdateSchema,
} from "@/lib/validations/security";

export async function listSecuritySettings() {
  const ctx = await requirePerm(PermissionScope.SECURITY_MANAGE);
  const [memberships, customRoles] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: ctx.orgId },
      include: {
        user: true,
        customRole: {
          include: { permissions: true },
        },
      },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    }),
    prisma.orgRole.findMany({
      where: { orgId: ctx.orgId },
      include: { permissions: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const builtInRoles = Object.values(Role).map((role) => ({
    role,
    permissions: permissionsForBuiltinRole(role),
  }));

  return {
    builtInRoles,
    customRoles,
    memberships,
    allPermissionScopes: ALL_PERMISSION_SCOPES,
  };
}

export async function createCustomRole(input: unknown) {
  const ctx = await requirePerm(PermissionScope.SECURITY_MANAGE);
  const parsed = customRoleCreateSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const role = await tx.orgRole.create({
      data: {
        orgId: ctx.orgId,
        name: parsed.name,
        description: parsed.description,
        createdById: ctx.userId,
        permissions: {
          createMany: {
            data: parsed.permissions.map((scope) => ({ orgId: ctx.orgId, scope })),
          },
        },
      },
      include: { permissions: true },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "OrgRole",
      entityId: role.id,
      action: AuditAction.CREATE,
      after: {
        id: role.id,
        name: role.name,
        permissions: role.permissions.map((item) => item.scope),
      },
    });
    return role;
  });
}

export async function updateCustomRole(input: unknown) {
  const ctx = await requirePerm(PermissionScope.SECURITY_MANAGE);
  const parsed = customRoleUpdateSchema.parse(input);
  const existing = await prisma.orgRole.findFirst({
    where: { id: parsed.roleId, orgId: ctx.orgId },
    include: { permissions: true },
  });
  if (!existing) throw new AppError("Role not found.", 404);

  return prisma.$transaction(async (tx) => {
    if (parsed.permissions) {
      await tx.rolePermission.deleteMany({ where: { roleId: existing.id } });
      if (parsed.permissions.length) {
        await tx.rolePermission.createMany({
          data: parsed.permissions.map((scope) => ({
            orgId: ctx.orgId,
            roleId: existing.id,
            scope,
          })),
        });
      }
    }

    const updated = await tx.orgRole.update({
      where: { id: existing.id },
      data: {
        name: parsed.name,
        description: parsed.description,
      },
      include: { permissions: true },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "OrgRole",
      entityId: existing.id,
      action: AuditAction.UPDATE,
      before: {
        name: existing.name,
        description: existing.description,
        permissions: existing.permissions.map((item) => item.scope),
      },
      after: {
        name: updated.name,
        description: updated.description,
        permissions: updated.permissions.map((item) => item.scope),
      },
    });

    return updated;
  });
}

export async function updateMembershipRole(input: unknown) {
  const ctx = await requirePerm(PermissionScope.SECURITY_MANAGE);
  const parsed = membershipRoleUpdateSchema.parse(input);

  const membership = await prisma.membership.findFirst({
    where: { id: parsed.membershipId, orgId: ctx.orgId },
  });
  if (!membership) throw new AppError("Membership not found.", 404);

  if (parsed.customRoleId) {
    const customRole = await prisma.orgRole.findFirst({
      where: { id: parsed.customRoleId, orgId: ctx.orgId },
    });
    if (!customRole) throw new AppError("Custom role not found.", 404);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.membership.update({
      where: { id: parsed.membershipId },
      data: {
        role: parsed.role,
        customRoleId: parsed.customRoleId ?? null,
      },
      include: {
        user: true,
        customRole: {
          include: { permissions: true },
        },
      },
    });

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "Membership",
      entityId: membership.id,
      action: AuditAction.UPDATE,
      before: membership,
      after: {
        role: updated.role,
        customRoleId: updated.customRoleId,
      },
    });

    return updated;
  });
}

export async function listAuditEvents(filters: unknown) {
  const ctx = await requirePerm(PermissionScope.AUDIT_READ);
  const parsed = auditFilterSchema.parse(filters ?? {});

  const where = {
    orgId: ctx.orgId,
    ...(parsed.entityType ? { entityType: parsed.entityType } : {}),
    ...(parsed.actorId ? { actorId: parsed.actorId } : {}),
    ...(parsed.action ? { action: parsed.action } : {}),
    ...(parsed.from || parsed.to
      ? {
          createdAt: {
            ...(parsed.from ? { gte: new Date(parsed.from) } : {}),
            ...(parsed.to ? { lte: new Date(parsed.to) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.auditEvent.findMany({
      where,
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return {
    items,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}

