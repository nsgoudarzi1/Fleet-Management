import { Activity, AlertTriangle, HandCoins, Timer } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { UnitsChart } from "@/components/shared/units-chart";
import { WorkQueue } from "@/components/shared/work-queue";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getDashboardData } from "@/lib/services/dashboard";

export default async function DashboardPage() {
  const data = await getDashboardData();

  const chartData = Object.entries(data.kpis.unitsByDay).map(([day, units]) => ({
    day: day.slice(5),
    units,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales & Inventory Work Queue"
        description="Prioritized daily actions to move inventory into funded, delivered deals."
        badges={["Inventory", "Deals", "Funding"]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/inventory?create=1">Receive Vehicle</Link>
            </Button>
            <Button asChild>
              <Link href="/deals/new">Create Deal</Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Units (30d)"
          value={`${data.kpis.units30}`}
          hint="Rolling 30-day delivery velocity"
          icon={<Activity className="h-4 w-4 text-cyan-700" />}
        />
        <KpiCard
          label="Gross (30d)"
          value={formatCurrency(data.kpis.gross30)}
          hint="Estimated front-end gross"
          icon={<HandCoins className="h-4 w-4 text-cyan-700" />}
        />
        <KpiCard
          label="Recon Aging"
          value={`${data.kpis.avgReconAge.toFixed(1)} days`}
          hint="Average acquired-to-ready lag"
          icon={<Timer className="h-4 w-4 text-cyan-700" />}
        />
        <KpiCard
          label="Lead Response"
          value={`${data.kpis.avgLeadResponseHours.toFixed(1)} hr`}
          hint="Average first-touch speed"
          icon={<AlertTriangle className="h-4 w-4 text-cyan-700" />}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Units Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <UnitsChart data={chartData} />
          </CardContent>
        </Card>
        <div className="grid gap-3">
          <WorkQueue
            title="Service Approvals Queue"
            items={data.serviceApprovals.map((ro) => ({
              id: ro.id,
              title: `${ro.roNumber} - ${ro.customer.firstName} ${ro.customer.lastName}`,
              subtitle: `${ro.vehicle.year} ${ro.vehicle.make} ${ro.vehicle.model}`,
              href: `/fixedops/repair-orders/${ro.id}`,
              priority: "high",
            }))}
            emptyLabel="No repair orders waiting for approval."
          />
          <WorkQueue
            title="Leads At Risk"
            items={data.leadsAtRisk.map((lead) => ({
              id: lead.id,
              title: `${lead.customer?.firstName ?? "Prospect"} ${lead.customer?.lastName ?? ""}`.trim(),
              subtitle: `SLA due ${formatDate(lead.slaDueAt, "MMM d, h:mm a")}`,
              href: `/crm/leads/${lead.id}`,
              priority: "high",
            }))}
            emptyLabel="No SLA risk items right now."
          />
          <WorkQueue
            title="Funding Queue"
            items={data.fundingPending.map((deal) => ({
              id: deal.id,
              title: `${deal.dealNumber} - ${deal.customer.firstName} ${deal.customer.lastName}`,
              subtitle: `Status ${deal.fundingStatus.replaceAll("_", " ")}`,
              href: `/deals/${deal.id}`,
            }))}
            emptyLabel="No deals waiting for funding."
          />
          <WorkQueue
            title="Overdue Tasks"
            items={data.overdueTasks.map((task) => ({
              id: task.id,
              title: task.title,
              subtitle: task.assignedTo?.name
                ? `Assigned to ${task.assignedTo.name}`
                : "Unassigned task",
              href: task.leadId ? `/crm/leads/${task.leadId}` : task.customerId ? `/crm/customers/${task.customerId}` : "/crm/leads",
              priority: "high",
            }))}
            emptyLabel="No overdue CRM tasks."
          />
          <WorkQueue
            title="Approval Queue"
            items={data.pendingApprovals.map((approval) => ({
              id: approval.id,
              title: approval.quote?.quoteNumber ?? approval.entityType,
              subtitle: `Requested by ${approval.requestedBy?.name ?? "Unknown"} • ${approval.delta}`,
              href: approval.quoteId ? `/quotes/${approval.quoteId}` : "/quotes",
              priority: "high",
            }))}
            emptyLabel="No pending discount approvals."
          />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Open Deals Requiring Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.dealsInProgress.length === 0 ? <p className="text-sm text-slate-500">No deals in progress.</p> : null}
            {data.dealsInProgress.map((deal) => (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {deal.dealNumber} - {deal.customer.firstName} {deal.customer.lastName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
                  </p>
                </div>
                <StatusBadge status={deal.stage} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.appointmentsToday.length === 0 ? <p className="text-sm text-slate-500">No appointments today.</p> : null}
            {data.appointmentsToday.map((appt) => (
              <div key={appt.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{appt.title}</p>
                <p className="text-xs text-slate-500">{formatDate(appt.scheduledAt, "h:mm a")}</p>
                <p className="text-xs text-slate-500">
                  {appt.customer ? `${appt.customer.firstName} ${appt.customer.lastName}` : "No customer linked"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

