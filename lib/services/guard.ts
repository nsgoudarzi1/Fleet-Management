import { PermissionScope, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROLE_RANK } from "@/lib/constants";
import { prisma } from "@/lib/db/prisma";
import { scopedOrgWhere } from "@/lib/services/org-scope";
import { mergeEffectivePermissions } from "@/lib/services/permissions";

export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  return session.user;
}

export function hasMinimumRole(actual: Role, minimum: Role) {
  return ROLE_RANK[actual] >= ROLE_RANK[minimum];
}

type OrgContext = {
  userId: string;
  orgId: string;
  role: Role;
  membershipId: string;
  customRoleId: string | null;
  permissions: PermissionScope[];
};

export async function requireOrgContext(minimumRole: Role = Role.VIEWER) {
  const user = await requireUser();
  if (!user.orgId) {
    throw new AppError("No organization selected for this user.", 403);
  }

  if (!hasMinimumRole(user.role, minimumRole)) {
    throw new AppError("Insufficient permission for this action.", 403);
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId: user.orgId,
      },
    },
    include: {
      customRole: {
        include: {
          permissions: {
            select: { scope: true },
          },
        },
      },
    },
  });
  if (!membership) {
    throw new AppError("Organization membership not found.", 403);
  }

  const customPermissions = membership.customRole?.permissions.map((item) => item.scope) ?? [];
  const permissions = mergeEffectivePermissions(user.role, customPermissions);

  return {
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    membershipId: membership.id,
    customRoleId: membership.customRoleId,
    permissions,
  } satisfies OrgContext;
}

function roleAllowed(actual: Role, allowed: Role[]) {
  if (actual === Role.OWNER) return true;
  return allowed.includes(actual);
}

export async function requireOrgRoles(allowed: Role[]) {
  const ctx = await requireOrgContext(Role.VIEWER);
  if (!roleAllowed(ctx.role, allowed)) {
    throw new AppError("Insufficient permission for this action.", 403);
  }
  return ctx;
}

export async function requirePerm(scope: PermissionScope) {
  const ctx = await requireOrgContext(Role.VIEWER);
  if (ctx.role !== Role.OWNER && !ctx.permissions.includes(scope)) {
    throw new AppError("Insufficient permission for this action.", 403);
  }
  return ctx;
}

export { scopedOrgWhere };
