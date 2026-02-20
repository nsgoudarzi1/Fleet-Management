import { PermissionScope, Role } from "@prisma/client";

export const ALL_PERMISSION_SCOPES: PermissionScope[] = [
  PermissionScope.INVENTORY_READ,
  PermissionScope.INVENTORY_WRITE,
  PermissionScope.CRM_READ,
  PermissionScope.CRM_WRITE,
  PermissionScope.DEALS_READ,
  PermissionScope.DEALS_WRITE,
  PermissionScope.FIXEDOPS_READ,
  PermissionScope.FIXEDOPS_WRITE,
  PermissionScope.FIXEDOPS_CLOSE,
  PermissionScope.ACCOUNTING_READ,
  PermissionScope.ACCOUNTING_POST,
  PermissionScope.FUNDING_MANAGE,
  PermissionScope.COMPLIANCE_MANAGE,
  PermissionScope.INTEGRATIONS_MANAGE,
  PermissionScope.IMPORT_MANAGE,
  PermissionScope.SECURITY_MANAGE,
  PermissionScope.AUDIT_READ,
];

const READ_SCOPES: PermissionScope[] = [
  PermissionScope.INVENTORY_READ,
  PermissionScope.CRM_READ,
  PermissionScope.DEALS_READ,
  PermissionScope.FIXEDOPS_READ,
  PermissionScope.ACCOUNTING_READ,
];

const BUILTIN_PERMISSIONS: Record<Role, PermissionScope[]> = {
  OWNER: ALL_PERMISSION_SCOPES,
  ADMIN: ALL_PERMISSION_SCOPES,
  MANAGER: [
    ...READ_SCOPES,
    PermissionScope.INVENTORY_WRITE,
    PermissionScope.CRM_WRITE,
    PermissionScope.DEALS_WRITE,
    PermissionScope.FIXEDOPS_WRITE,
    PermissionScope.FIXEDOPS_CLOSE,
    PermissionScope.ACCOUNTING_POST,
    PermissionScope.FUNDING_MANAGE,
    PermissionScope.AUDIT_READ,
  ],
  SALES: [
    PermissionScope.INVENTORY_READ,
    PermissionScope.CRM_READ,
    PermissionScope.CRM_WRITE,
    PermissionScope.DEALS_READ,
    PermissionScope.DEALS_WRITE,
    PermissionScope.ACCOUNTING_READ,
  ],
  ACCOUNTING: [
    PermissionScope.CRM_READ,
    PermissionScope.DEALS_READ,
    PermissionScope.DEALS_WRITE,
    PermissionScope.FIXEDOPS_READ,
    PermissionScope.FIXEDOPS_CLOSE,
    PermissionScope.ACCOUNTING_READ,
    PermissionScope.ACCOUNTING_POST,
    PermissionScope.FUNDING_MANAGE,
    PermissionScope.AUDIT_READ,
    PermissionScope.COMPLIANCE_MANAGE,
  ],
  SERVICE: [
    PermissionScope.INVENTORY_READ,
    PermissionScope.INVENTORY_WRITE,
    PermissionScope.CRM_READ,
    PermissionScope.DEALS_READ,
    PermissionScope.FIXEDOPS_READ,
    PermissionScope.FIXEDOPS_WRITE,
  ],
  VIEWER: READ_SCOPES,
};

export function permissionsForBuiltinRole(role: Role) {
  return BUILTIN_PERMISSIONS[role];
}

export function mergeEffectivePermissions(role: Role, custom: PermissionScope[]) {
  return Array.from(new Set([...permissionsForBuiltinRole(role), ...custom]));
}

