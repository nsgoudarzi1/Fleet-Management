import { AuditAction, PermissionScope, Role } from "@prisma/client";
import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const customRoleCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: optionalString,
  permissions: z.array(z.nativeEnum(PermissionScope)).min(1),
});

export const customRoleUpdateSchema = customRoleCreateSchema.partial().extend({
  roleId: z.string().cuid(),
});

export const membershipRoleUpdateSchema = z.object({
  membershipId: z.string().cuid(),
  role: z.nativeEnum(Role),
  customRoleId: z.string().cuid().nullable().optional(),
});

export const auditFilterSchema = z.object({
  entityType: optionalString,
  actorId: z.string().cuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

