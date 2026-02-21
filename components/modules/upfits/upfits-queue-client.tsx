"use client";

import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EntityDrawer } from "@/components/shared/entity-drawer";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { SavedViewsBar } from "@/components/tables/saved-views-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";

type UpfitRow = {
  id: string;
  status: string;
  vehicle: { id: string; stockNumber: string; year: number; make: string; model: string } | null;
  deal: { id: string; dealNumber: string } | null;
  quote: { id: string; quoteNumber: string } | null;
  vendor: { name: string } | null;
  eta: string | Date | null;
  costEstimate: string | number;
  actualCost: string | number;
  milestones: Array<{ id: string; name: string; completedAt: string | Date | null }>;
};

export function UpfitsQueueClient({ rows }: { rows: UpfitRow[] }) {
  const [saving, setSaving] = useState(false);

  const columns = useMemo(
    () => [
      {
        key: "unit",
        label: "Unit / Deal",
        render: (row: UpfitRow) => (
          <div>
            <p className="font-medium text-slate-900">
              {row.vehicle ? `${row.vehicle.stockNumber} - ${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}` : "Unassigned Unit"}
            </p>
            <p className="text-xs text-slate-500">
              {row.deal ? row.deal.dealNumber : row.quote ? row.quote.quoteNumber : "No deal or quote link"}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (row: UpfitRow) => <StatusBadge status={row.status} />,
      },
      {
        key: "vendor",
        label: "Vendor",
        render: (row: UpfitRow) => row.vendor?.name ?? "Unassigned",
      },
      {
        key: "eta",
        label: "ETA",
        render: (row: UpfitRow) => (row.eta ? formatDate(row.eta) : "-"),
      },
      {
        key: "cost",
        label: "Estimate / Actual",
        render: (row: UpfitRow) => `${formatCurrency(row.costEstimate)} / ${formatCurrency(row.actualCost)}`,
      },
      {
        key: "milestones",
        label: "Milestones",
        render: (row: UpfitRow) => {
          const done = row.milestones.filter((item) => !!item.completedAt).length;
          return `${done}/${row.milestones.length}`;
        },
      },
    ],
    [],
  );

  const createJob = async (formData: FormData) => {
    setSaving(true);
    const response = await fetch("/api/upfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: String(formData.get("vehicleId") ?? "") || undefined,
        dealId: String(formData.get("dealId") ?? "") || undefined,
        quoteId: String(formData.get("quoteId") ?? "") || undefined,
        vendorId: String(formData.get("vendorId") ?? "") || undefined,
        eta: formData.get("eta") ? new Date(String(formData.get("eta"))).toISOString() : undefined,
        costEstimate: Number(formData.get("costEstimate") ?? 0),
        actualCost: Number(formData.get("actualCost") ?? 0),
        billableToCustomer: formData.get("billableToCustomer") === "on",
        includeActualCosts: formData.get("includeActualCosts") === "on",
        internalNotes: String(formData.get("internalNotes") ?? ""),
        milestones: String(formData.get("milestones") ?? "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
      }),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Unable to create upfit job");
      return;
    }
    window.location.reload();
  };

  const setStatus = async (jobId: string, status: string) => {
    const response = await fetch("/api/upfits/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status }),
    });
    if (!response.ok) {
      toast.error("Unable to update upfit status");
      return;
    }
    window.location.reload();
  };

  const completeMilestone = async (milestoneId: string) => {
    const response = await fetch("/api/upfits/milestones/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneId }),
    });
    if (!response.ok) {
      toast.error("Unable to complete milestone");
      return;
    }
    window.location.reload();
  };

  return (
    <div>
      <SavedViewsBar entityKey="upfits" />
      <DataTable
        rows={rows}
        columns={columns}
        storageKey="upfits-table"
        actions={
          <EntityDrawer
            title="Create Upfit Job"
            description="Track vendor milestones and cost rollups tied to vehicle/deal/quote."
            trigger={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Upfit Job
              </Button>
            }
          >
            <form action={createJob} className="space-y-3">
              <Input name="vehicleId" placeholder="Vehicle ID (optional)" />
              <Input name="dealId" placeholder="Deal ID (optional)" />
              <Input name="quoteId" placeholder="Quote ID (optional)" />
              <Input name="vendorId" placeholder="Vendor ID (optional)" />
              <Input name="eta" type="datetime-local" />
              <Input name="costEstimate" type="number" placeholder="Estimate" />
              <Input name="actualCost" type="number" placeholder="Actual Cost" />
              <Input name="milestones" placeholder="Milestones (comma separated)" />
              <Input name="internalNotes" placeholder="Internal Notes" />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="billableToCustomer" defaultChecked />
                Billable to customer
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="includeActualCosts" />
                Roll up actual cost
              </label>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : "Create Upfit Job"}
              </Button>
            </form>
          </EntityDrawer>
        }
        rowActions={(row) => (
          <div className="flex flex-wrap justify-end gap-1">
            <select
              defaultValue={row.status}
              className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
              onChange={(event) => void setStatus(row.id, event.target.value)}
            >
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_PARTS">Waiting Parts</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELED">Canceled</option>
            </select>
            <Button asChild variant="ghost" size="sm">
              <Link href={row.vehicle ? `/inventory/${row.vehicle.id}` : row.deal ? `/deals/${row.deal.id}` : "/quotes"}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            {row.milestones.find((item) => !item.completedAt) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void completeMilestone(row.milestones.find((item) => !item.completedAt)!.id)}
              >
                Complete Next
              </Button>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
