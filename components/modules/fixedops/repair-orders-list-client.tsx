"use client";

import Link from "next/link";
import { Plus, RefreshCw, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/data-table";
import { SavedViewsBar } from "@/components/tables/saved-views-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";

type RepairOrderRow = {
  id: string;
  roNumber: string;
  status: string;
  createdAt: string | Date;
  customer: { id: string; firstName: string; lastName: string };
  vehicle: { id: string; year: number; make: string; model: string; stockNumber: string };
  advisor: { id: string; name: string | null } | null;
  grandTotal: string | number;
  lines: Array<{ id: string }>;
};

type SimpleOption = { id: string; label: string };

export function RepairOrdersListClient({
  rows,
  customerOptions,
  vehicleOptions,
}: {
  rows: RepairOrderRow[];
  customerOptions: SimpleOption[];
  vehicleOptions: SimpleOption[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const columns = useMemo(
    () => [
      {
        key: "roNumber",
        label: "RO",
        render: (row: RepairOrderRow) => (
          <div>
            <p className="font-medium text-slate-900">{row.roNumber}</p>
            <p className="text-xs text-slate-500">Created {formatDate(row.createdAt, "MMM d, h:mm a")}</p>
          </div>
        ),
      },
      {
        key: "customer",
        label: "Customer",
        render: (row: RepairOrderRow) => `${row.customer.firstName} ${row.customer.lastName}`,
      },
      {
        key: "vehicle",
        label: "Vehicle",
        render: (row: RepairOrderRow) => `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}`,
      },
      {
        key: "status",
        label: "Status",
        render: (row: RepairOrderRow) => <StatusBadge status={row.status} />,
      },
      {
        key: "lineCount",
        label: "Lines",
        render: (row: RepairOrderRow) => row.lines.length,
      },
      {
        key: "grandTotal",
        label: "Total",
        render: (row: RepairOrderRow) => formatCurrency(row.grandTotal),
      },
      {
        key: "advisor",
        label: "Advisor",
        render: (row: RepairOrderRow) => row.advisor?.name ?? "-",
      },
    ],
    [],
  );

  const bulkMarkInProgress = async () => {
    if (!selectedIds.length) {
      toast.error("Select at least one repair order.");
      return;
    }

    const responses = await Promise.all(
      selectedIds.map((repairOrderId) =>
        fetch("/api/fixedops/repair-orders/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repairOrderId, status: "IN_PROGRESS" }),
        }),
      ),
    );

    if (responses.some((response) => !response.ok)) {
      toast.error("Some repair orders failed to update.");
      return;
    }

    toast.success(`Moved ${selectedIds.length} repair orders to IN_PROGRESS.`);
    window.location.reload();
  };

  return (
    <div className="space-y-3">
      <SavedViewsBar entityKey="fixedops-repair-orders" />
      <DataTable
        rows={rows}
        columns={columns}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        storageKey="fixedops-repair-orders-table"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={bulkMarkInProgress}>
              <Wrench className="mr-2 h-4 w-4" />
              Bulk Start
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <CreateRepairOrderDialog customerOptions={customerOptions} vehicleOptions={vehicleOptions} />
          </div>
        }
        rowActions={(row) => (
          <Button asChild variant="outline" size="sm">
            <Link href={`/fixedops/repair-orders/${row.id}`}>Open</Link>
          </Button>
        )}
      />
    </div>
  );
}

function CreateRepairOrderDialog({
  customerOptions,
  vehicleOptions,
}: {
  customerOptions: SimpleOption[];
  vehicleOptions: SimpleOption[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async (formData: FormData) => {
    setSaving(true);
    const payload = {
      customerId: String(formData.get("customerId") ?? ""),
      vehicleId: String(formData.get("vehicleId") ?? ""),
      customerNotes: String(formData.get("customerNotes") ?? "") || undefined,
      internalNotes: String(formData.get("internalNotes") ?? "") || undefined,
    };

    const response = await fetch("/api/fixedops/repair-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!response.ok) {
      toast.error("Unable to create repair order.");
      return;
    }

    const body = (await response.json()) as { data: { id: string } };
    toast.success("Repair order created.");
    setOpen(false);
    window.location.href = `/fixedops/repair-orders/${body.data.id}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New RO
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Repair Order</DialogTitle>
        </DialogHeader>
        <form action={create} className="grid gap-3">
          <select name="customerId" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" required>
            <option value="">Select customer</option>
            {customerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select name="vehicleId" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" required>
            <option value="">Select vehicle</option>
            {vehicleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Input name="customerNotes" placeholder="Customer notes" />
          <Textarea name="internalNotes" placeholder="Internal notes" />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create RO"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
