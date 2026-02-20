"use client";

import Link from "next/link";
import { Boxes, FilePlus2, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/data-table";
import { SavedViewsBar } from "@/components/tables/saved-views-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

type PartRow = {
  id: string;
  partNumber: string;
  description: string;
  binLocation: string | null;
  onHandQty: string | number;
  reservedQty: string | number;
  reorderPoint: string | number;
  unitCost: string | number;
  unitPrice: string | number;
  vendor: { id: string; name: string } | null;
};

type VendorOption = { id: string; label: string };

export function PartsListClient({
  rows,
  vendorOptions,
}: {
  rows: PartRow[];
  vendorOptions: VendorOption[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const columns = useMemo(
    () => [
      {
        key: "partNumber",
        label: "Part",
        render: (row: PartRow) => (
          <div>
            <p className="font-medium text-slate-900">{row.partNumber}</p>
            <p className="text-xs text-slate-500">{row.description}</p>
          </div>
        ),
      },
      {
        key: "vendor",
        label: "Vendor",
        render: (row: PartRow) => row.vendor?.name ?? "-",
      },
      {
        key: "onHandQty",
        label: "On Hand",
        render: (row: PartRow) => Number(row.onHandQty).toFixed(2),
      },
      {
        key: "reservedQty",
        label: "Reserved",
        render: (row: PartRow) => Number(row.reservedQty).toFixed(2),
      },
      {
        key: "reorderPoint",
        label: "Reorder",
        render: (row: PartRow) => Number(row.reorderPoint).toFixed(2),
      },
      {
        key: "unitCost",
        label: "Cost",
        render: (row: PartRow) => formatCurrency(row.unitCost),
      },
      {
        key: "unitPrice",
        label: "Price",
        render: (row: PartRow) => formatCurrency(row.unitPrice),
      },
      {
        key: "binLocation",
        label: "Bin",
      },
    ],
    [],
  );

  const runBulkAdjust = async () => {
    if (!selectedIds.length) {
      toast.error("Select at least one part for cycle-count adjustment.");
      return;
    }

    const deltaRaw = window.prompt("Enter quantity delta (can be negative):", "0");
    if (!deltaRaw) return;
    const delta = Number(deltaRaw);
    if (Number.isNaN(delta) || delta === 0) {
      toast.error("Quantity delta must be a non-zero number.");
      return;
    }

    const reason = window.prompt("Adjustment reason (required):", "Cycle count") ?? "";
    if (!reason.trim()) {
      toast.error("Adjustment reason is required.");
      return;
    }

    const responses = await Promise.all(
      selectedIds.map((partId) =>
        fetch("/api/fixedops/parts/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partId,
            quantityDelta: delta,
            reason,
          }),
        }),
      ),
    );

    if (responses.some((response) => !response.ok)) {
      toast.error("Some adjustments failed.");
      return;
    }

    toast.success(`Adjusted ${selectedIds.length} parts.`);
    window.location.reload();
  };

  return (
    <div className="space-y-3">
      <SavedViewsBar entityKey="fixedops-parts" />
      <DataTable
        rows={rows}
        columns={columns}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        storageKey="fixedops-parts-table"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={runBulkAdjust}>
              <Boxes className="mr-2 h-4 w-4" />
              Cycle Count
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <ReceivePartsDialog partOptions={rows.map((row) => ({ id: row.id, label: `${row.partNumber} ${row.description}` }))} />
            <CreatePartDialog vendorOptions={vendorOptions} />
          </div>
        }
        rowActions={(row) => (
          <Button asChild size="sm" variant="outline">
            <Link href={`/fixedops/parts/${row.id}`}>Open</Link>
          </Button>
        )}
      />
    </div>
  );
}

function CreatePartDialog({ vendorOptions }: { vendorOptions: VendorOption[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const createPart = async (formData: FormData) => {
    setSaving(true);
    const payload = {
      partNumber: String(formData.get("partNumber") ?? ""),
      description: String(formData.get("description") ?? ""),
      vendorId: String(formData.get("vendorId") ?? "") || undefined,
      binLocation: String(formData.get("binLocation") ?? "") || undefined,
      reorderPoint: Number(formData.get("reorderPoint") ?? 0),
      unitCost: Number(formData.get("unitCost") ?? 0),
      unitPrice: Number(formData.get("unitPrice") ?? 0),
      taxable: formData.get("taxable") === "on",
      allowNegative: formData.get("allowNegative") === "on",
    };

    const response = await fetch("/api/fixedops/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!response.ok) {
      toast.error("Unable to create part.");
      return;
    }

    toast.success("Part created.");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Part
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Part</DialogTitle>
        </DialogHeader>
        <form action={createPart} className="grid gap-2 sm:grid-cols-2">
          <Input name="partNumber" placeholder="Part #" required />
          <Input name="description" placeholder="Description" required />
          <select name="vendorId" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm sm:col-span-2">
            <option value="">No vendor</option>
            {vendorOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <Input name="binLocation" placeholder="Bin location" />
          <Input name="reorderPoint" type="number" step="0.01" placeholder="Reorder point" defaultValue={0} />
          <Input name="unitCost" type="number" step="0.01" placeholder="Unit cost" defaultValue={0} />
          <Input name="unitPrice" type="number" step="0.01" placeholder="Unit price" defaultValue={0} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="taxable" defaultChecked />Taxable</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowNegative" />Allow negative inventory</label>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Create Part"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceivePartsDialog({ partOptions }: { partOptions: VendorOption[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const receive = async (formData: FormData) => {
    setSaving(true);
    const payload = {
      partId: String(formData.get("partId") ?? ""),
      quantity: Number(formData.get("quantity") ?? 0),
      unitCost: Number(formData.get("unitCost") ?? 0),
      reference: String(formData.get("reference") ?? "") || undefined,
      reason: String(formData.get("reason") ?? "") || undefined,
    };

    const response = await fetch("/api/fixedops/parts/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!response.ok) {
      toast.error("Unable to receive parts.");
      return;
    }

    toast.success("Parts received.");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Receive</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Parts</DialogTitle>
        </DialogHeader>
        <form action={receive} className="grid gap-2">
          <select name="partId" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" required>
            <option value="">Select part</option>
            {partOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <Input name="quantity" type="number" step="0.01" placeholder="Quantity" required />
          <Input name="unitCost" type="number" step="0.01" placeholder="Unit cost" required />
          <Input name="reference" placeholder="Reference" />
          <Input name="reason" placeholder="Reason" />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Receive"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
