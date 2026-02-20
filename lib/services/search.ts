import { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/services/guard";

export async function universalSearch(query: string) {
  const ctx = await requireOrgContext(Role.VIEWER);
  const q = query.trim();
  if (!q) return [];

  const [customers, vehicles, deals, leads, payments, repairOrders, parts] = await Promise.all([
    prisma.customer.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.vehicle.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [
          { vin: { contains: q, mode: "insensitive" } },
          { stockNumber: { contains: q, mode: "insensitive" } },
          { make: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.deal.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [{ dealNumber: { contains: q, mode: "insensitive" } }],
      },
      include: {
        customer: true,
        vehicle: true,
      },
      take: 5,
    }),
    prisma.lead.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [
          { source: { contains: q, mode: "insensitive" } },
          { statusNote: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        customer: true,
      },
      take: 5,
    }),
    prisma.payment.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [{ reference: { contains: q, mode: "insensitive" } }],
      },
      include: {
        deal: true,
      },
      take: 5,
    }),
    prisma.repairOrder.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [{ roNumber: { contains: q, mode: "insensitive" } }],
      },
      include: {
        customer: true,
        vehicle: true,
      },
      take: 5,
    }),
    prisma.part.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [
          { partNumber: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
  ]);

  return [
    ...customers.map((customer) => ({
      id: customer.id,
      type: "customer",
      label: `${customer.firstName} ${customer.lastName}`,
      subLabel: customer.email ?? customer.phone ?? "Customer",
      href: `/crm/customers/${customer.id}`,
    })),
    ...vehicles.map((vehicle) => ({
      id: vehicle.id,
      type: "vehicle",
      label: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      subLabel: `${vehicle.stockNumber} • ${vehicle.vin}`,
      href: `/inventory/${vehicle.id}`,
    })),
    ...deals.map((deal) => ({
      id: deal.id,
      type: "deal",
      label: `${deal.dealNumber}`,
      subLabel: `${deal.customer.firstName} ${deal.customer.lastName} • ${deal.vehicle.stockNumber}`,
      href: `/deals/${deal.id}`,
    })),
    ...leads.map((lead) => ({
      id: lead.id,
      type: "lead",
      label: `${lead.source} Lead`,
      subLabel: lead.customer ? `${lead.customer.firstName} ${lead.customer.lastName}` : "Unassigned customer",
      href: `/crm/leads/${lead.id}`,
    })),
    ...payments.map((payment) => ({
      id: payment.id,
      type: "payment",
      label: `Payment ${payment.reference ?? payment.id.slice(0, 6)}`,
      subLabel: payment.deal ? `Deal ${payment.deal.dealNumber}` : "Standalone payment",
      href: "/accounting",
    })),
    ...repairOrders.map((ro) => ({
      id: ro.id,
      type: "repairOrder",
      label: ro.roNumber,
      subLabel: `${ro.customer.firstName} ${ro.customer.lastName} • ${ro.vehicle.stockNumber}`,
      href: `/fixedops/repair-orders/${ro.id}`,
    })),
    ...parts.map((part) => ({
      id: part.id,
      type: "part",
      label: `${part.partNumber}`,
      subLabel: part.description,
      href: `/fixedops/parts/${part.id}`,
    })),
  ];
}
