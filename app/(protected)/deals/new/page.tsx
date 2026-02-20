import { NewDealForm } from "@/components/modules/deals/new-deal-form";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/services/guard";
import { Role } from "@prisma/client";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const vehicleId = typeof params.vehicleId === "string" ? params.vehicleId : undefined;
  const customerId = typeof params.customerId === "string" ? params.customerId : undefined;
  const ctx = await requireOrgContext(Role.SALES);

  const [vehicles, customers, salespeople] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        orgId: ctx.orgId,
        status: { in: ["READY", "LISTED", "ON_HOLD"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.customer.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.membership.findMany({
      where: {
        orgId: ctx.orgId,
        role: { in: ["SALES", "MANAGER", "OWNER", "ADMIN"] },
      },
      include: {
        user: true,
      },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Deal"
        description="Start from vehicle + customer, then progress through desking-lite stages."
      />
      <NewDealForm
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          label: `${vehicle.stockNumber} • ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        }))}
        customers={customers.map((customer) => ({
          id: customer.id,
          label: `${customer.firstName} ${customer.lastName}`,
        }))}
        salespeople={salespeople.map((member) => ({
          id: member.userId,
          label: member.user.name ?? member.user.email,
        }))}
        defaultVehicleId={vehicleId}
        defaultCustomerId={customerId}
      />
    </div>
  );
}
