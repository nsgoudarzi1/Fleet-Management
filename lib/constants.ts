import type { Role } from "@prisma/client";

export const APP_NAME = "FleetFlow DMS";

export const ROLE_RANK: Record<Role, number> = {
  OWNER: 100,
  ADMIN: 90,
  MANAGER: 80,
  ACCOUNTING: 70,
  SERVICE: 60,
  SALES: 50,
  VIEWER: 10,
};

export const NAV_ITEMS = [
  { href: "/app", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/quotes", label: "Quotes" },
  { href: "/operations/upfits", label: "Upfits" },
  { href: "/reports", label: "Reports" },
  { href: "/fixedops", label: "Fixed Ops" },
  { href: "/crm/fleet", label: "Fleet" },
  { href: "/crm/customers", label: "Customers" },
  { href: "/crm/leads", label: "Leads" },
  { href: "/deals", label: "Deals" },
  { href: "/funding", label: "Funding" },
  { href: "/accounting", label: "Accounting" },
  { href: "/settings", label: "Settings" },
];
