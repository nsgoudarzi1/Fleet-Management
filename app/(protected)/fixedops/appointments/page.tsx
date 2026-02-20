import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ServiceAppointmentsListClient } from "@/components/modules/fixedops/service-appointments-list-client";
import { listServiceAppointments, listTechnicians } from "@/lib/services/fixedops";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/services/guard";

export default async function FixedOpsAppointmentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;

  const ctx = await requireOrgContext(Role.VIEWER);
  const [appointments, technicians, customers, vehicles] = await Promise.all([
    listServiceAppointments({ query, status, page: 1, pageSize: 100 }),
    listTechnicians(),
    prisma.customer.findMany({ where: { orgId: ctx.orgId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.vehicle.findMany({ where: { orgId: ctx.orgId }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Service Appointments" description="Day view list with rapid appointment to RO conversion." />
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <form className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
          <Input name="q" defaultValue={query} placeholder="Search customer, vehicle, concern" />
          <select name="status" defaultValue={status ?? ""} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">All statuses</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CHECKED_IN">CHECKED IN</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="NO_SHOW">NO SHOW</option>
            <option value="CANCELED">CANCELED</option>
          </select>
          <Button type="submit" variant="outline">Apply</Button>
        </form>
      </section>
      <ServiceAppointmentsListClient
        rows={appointments.items as never[]}
        customerOptions={customers.map((customer) => ({ id: customer.id, label: `${customer.firstName} ${customer.lastName}` }))}
        vehicleOptions={vehicles.map((vehicle) => ({ id: vehicle.id, label: `${vehicle.stockNumber} ${vehicle.year} ${vehicle.make} ${vehicle.model}` }))}
        technicianOptions={technicians.map((technician) => ({ id: technician.id, label: technician.displayName }))}
      />
    </div>
  );
}
