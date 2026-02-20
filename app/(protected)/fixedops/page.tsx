import Link from "next/link";
import { Wrench, ClipboardCheck, Boxes } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { WorkQueue } from "@/components/shared/work-queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { fixedOpsWorkQueue } from "@/lib/services/fixedops";

export default async function FixedOpsHomePage() {
  const queue = await fixedOpsWorkQueue();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fixed Ops Work Queue"
        description="Scan ? allocate ? done. Service and parts tasks prioritized by actionability."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/fixedops/appointments">Appointments</Link>
            </Button>
            <Button asChild>
              <Link href="/fixedops/repair-orders">Repair Orders</Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 xl:grid-cols-3">
        <WorkQueue
          title="Waiting Approvals"
          items={queue.waitingApprovals.map((ro) => ({
            id: ro.id,
            title: `${ro.roNumber} • ${ro.customer.firstName} ${ro.customer.lastName}`,
            subtitle: `${ro.vehicle.year} ${ro.vehicle.make} ${ro.vehicle.model}`,
            href: `/fixedops/repair-orders/${ro.id}`,
            priority: "high",
          }))}
          emptyLabel="No repair orders waiting on approval."
        />
        <WorkQueue
          title="ROs Aging"
          items={queue.agingRos.map((ro) => ({
            id: ro.id,
            title: `${ro.roNumber} • ${ro.customer.firstName} ${ro.customer.lastName}`,
            subtitle: `Opened ${formatDate(ro.createdAt, "MMM d")}`,
            href: `/fixedops/repair-orders/${ro.id}`,
            priority: "high",
          }))}
          emptyLabel="No aging repair orders."
        />
        <WorkQueue
          title="Parts To Pick"
          items={queue.partsToPick.map((line) => ({
            id: line.id,
            title: `${line.repairOrder.roNumber} • ${line.part?.partNumber ?? "No part"}`,
            subtitle: line.description,
            href: `/fixedops/repair-orders/${line.repairOrderId}`,
          }))}
          emptyLabel="No parts waiting to be picked."
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><Wrench className="h-4 w-4" />Techs Clocked In</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {queue.techClockedIn.map((punch) => (
              <div key={punch.id} className="rounded border border-slate-200 p-2">
                <p className="font-medium text-slate-900">{punch.technician.displayName}</p>
                <p className="text-xs text-slate-500">{punch.repairOrder.roNumber} • {formatDate(punch.clockInAt, "h:mm a")}</p>
              </div>
            ))}
            {queue.techClockedIn.length === 0 ? <p className="text-slate-500">No open punches.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><ClipboardCheck className="h-4 w-4" />Quick Nav</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/fixedops/appointments">Service Appointments</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/fixedops/repair-orders">Repair Orders</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/fixedops/parts">Parts Inventory</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><Boxes className="h-4 w-4" />Load Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded border border-slate-200 p-2"><span>Approvals</span><span className="font-semibold">{queue.waitingApprovals.length}</span></div>
            <div className="flex items-center justify-between rounded border border-slate-200 p-2"><span>Aging ROs</span><span className="font-semibold">{queue.agingRos.length}</span></div>
            <div className="flex items-center justify-between rounded border border-slate-200 p-2"><span>Parts Picks</span><span className="font-semibold">{queue.partsToPick.length}</span></div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
