import { Role } from "@prisma/client";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/services/guard";
import { formatDate } from "@/lib/utils";

export default async function SettingsPage() {
  const ctx = await requireOrgContext(Role.VIEWER);

  async function updateOrgSettings(formData: FormData) {
    "use server";
    const inner = await requireOrgContext(Role.ADMIN);
    await prisma.organization.update({
      where: { id: inner.orgId },
      data: {
        taxRate: Number(formData.get("taxRate") ?? 0),
        docFee: Number(formData.get("docFee") ?? 0),
        licenseFee: Number(formData.get("licenseFee") ?? 0),
        leadSlaMinutes: Number(formData.get("leadSlaMinutes") ?? 15),
        taskOverdueGraceMinutes: Number(formData.get("taskOverdueGraceMinutes") ?? 0),
      },
    });
  }

  const [org, memberships, latestAudit, recordCounts] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    prisma.membership.findMany({
      where: { orgId: ctx.orgId },
      include: {
        user: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditEvent.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    Promise.all([
      prisma.vehicle.count({ where: { orgId: ctx.orgId } }),
      prisma.customer.count({ where: { orgId: ctx.orgId } }),
      prisma.deal.count({ where: { orgId: ctx.orgId } }),
      prisma.payment.count({ where: { orgId: ctx.orgId } }),
      prisma.auditEvent.count({ where: { orgId: ctx.orgId } }),
    ]),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Organization config, users, roles, and system observability."
      />
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Org Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateOrgSettings} className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span>Tax Rate</span>
                <Input name="taxRate" type="number" step="0.0001" defaultValue={Number(org.taxRate)} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Doc Fee</span>
                <Input name="docFee" type="number" step="0.01" defaultValue={Number(org.docFee)} />
              </label>
              <label className="space-y-1 text-sm">
                <span>License Fee</span>
                <Input name="licenseFee" type="number" step="0.01" defaultValue={Number(org.licenseFee)} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Lead SLA Minutes</span>
                <Input name="leadSlaMinutes" type="number" min={1} defaultValue={Number(org.leadSlaMinutes)} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Task Overdue Grace Minutes</span>
                <Input name="taskOverdueGraceMinutes" type="number" min={0} defaultValue={Number(org.taskOverdueGraceMinutes)} />
              </label>
              <div className="sm:col-span-3 flex justify-end">
                <Button type="submit">Save Config</Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded border border-slate-200 p-2">
              <span>Vehicles</span>
              <span className="font-semibold">{recordCounts[0]}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-slate-200 p-2">
              <span>Customers</span>
              <span className="font-semibold">{recordCounts[1]}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-slate-200 p-2">
              <span>Deals</span>
              <span className="font-semibold">{recordCounts[2]}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-slate-200 p-2">
              <span>Payments</span>
              <span className="font-semibold">{recordCounts[3]}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-slate-200 p-2">
              <span>Audit Events</span>
              <span className="font-semibold">{recordCounts[4]}</span>
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users & Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {memberships.map((membership) => (
              <div key={membership.id} className="flex items-center justify-between rounded border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{membership.user.name ?? membership.user.email}</p>
                  <p className="text-xs text-slate-500">{membership.user.email}</p>
                </div>
                <Badge variant={membership.role === "OWNER" || membership.role === "ADMIN" ? "default" : "outline"}>
                  {membership.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {latestAudit.map((audit) => (
              <div key={audit.id} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">
                  {audit.action} {audit.entityType}
                </p>
                <p className="text-xs text-slate-500">
                  Entity: {audit.entityId} • {formatDate(audit.createdAt, "MMM d, h:mm a")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compliance Manager</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-slate-600">
              Not legal advice. Configure templates and jurisdiction rule sets with compliance counsel review.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/settings/compliance/templates">Template Manager</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/settings/compliance/rules">Rules Engine</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/settings/integrations">Integrations</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/settings/security">Security</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/settings/audit">Audit Log</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/settings/import">CSV Import</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
