"use client";

import Link from "next/link";
import Papa from "papaparse";
import { Download, Eye, FileUp, Plus, Wrench } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EntityDrawer } from "@/components/shared/entity-drawer";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { SavedViewsBar } from "@/components/tables/saved-views-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";

type VehicleRow = {
  id: string;
  vin: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  mileage: number;
  status: string;
  listPrice: string | number;
  acquiredAt: string | Date;
  location: string | null;
  reconTasks: Array<{ id: string; status: string }>;
};

const BULK_STATUSES = ["ACQUIRED", "RECON", "READY", "LISTED", "ON_HOLD", "SOLD", "DELIVERED"];

export function InventoryListClient({ rows }: { rows: VehicleRow[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("READY");
  const [loading, setLoading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const csv = Papa.unparse(
      rows.map((row) => ({
        id: row.id,
        stockNumber: row.stockNumber,
        vin: row.vin,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.trim ?? "",
        status: row.status,
        mileage: row.mileage,
        listPrice: row.listPrice,
        acquiredAt: formatDate(row.acquiredAt, "yyyy-MM-dd"),
      })),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const rowsToCreate = (result.data as Array<Record<string, string>>).map((row) => ({
          vin: row.vin ?? "",
          stockNumber: row.stockNumber ?? "",
          year: Number(row.year ?? 0),
          make: row.make ?? "",
          model: row.model ?? "",
          trim: row.trim ?? undefined,
          mileage: Number(row.mileage ?? 0),
          purchaseSource: row.purchaseSource ?? "CSV Import",
          listPrice: Number(row.listPrice ?? 0),
          minPrice: row.minPrice ? Number(row.minPrice) : undefined,
          location: row.location ?? undefined,
          status: row.status ?? "ACQUIRED",
        }));
        try {
          await Promise.all(
            rowsToCreate.map((payload) =>
              fetch("/api/vehicles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }),
            ),
          );
          toast.success(`Imported ${rowsToCreate.length} vehicles`);
          window.location.reload();
        } catch {
          toast.error("CSV import failed");
        } finally {
          setLoading(false);
        }
      },
      error: () => {
        toast.error("Unable to parse CSV");
        setLoading(false);
      },
    });
  };

  const bulkUpdateStatus = async () => {
    if (selectedIds.length === 0) {
      toast.error("Select at least one vehicle first.");
      return;
    }
    setLoading(true);
    const response = await fetch("/api/vehicles/bulk-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleIds: selectedIds,
        status: bulkStatus,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      toast.error("Bulk update failed");
      return;
    }
    toast.success(`Updated ${selectedIds.length} vehicles`);
    window.location.reload();
  };

  const columns = useMemo(
    () => [
      {
        key: "stockNumber",
        label: "Stock",
        render: (row: VehicleRow) => (
          <div>
            <p className="font-medium text-slate-900">{row.stockNumber}</p>
            <p className="text-xs text-slate-500">{row.vin}</p>
          </div>
        ),
      },
      {
        key: "unit",
        label: "Vehicle",
        render: (row: VehicleRow) => `${row.year} ${row.make} ${row.model}`,
      },
      {
        key: "status",
        label: "Status",
        render: (row: VehicleRow) => <StatusBadge status={row.status} />,
      },
      {
        key: "mileage",
        label: "Mileage",
        render: (row: VehicleRow) => row.mileage.toLocaleString(),
      },
      {
        key: "listPrice",
        label: "List Price",
        render: (row: VehicleRow) => formatCurrency(row.listPrice),
      },
      {
        key: "recon",
        label: "Recon",
        render: (row: VehicleRow) => `${row.reconTasks.length} tasks`,
      },
      {
        key: "acquiredAt",
        label: "Acquired",
        render: (row: VehicleRow) => formatDate(row.acquiredAt),
      },
      {
        key: "location",
        label: "Location",
      },
    ],
    [],
  );

  return (
    <div>
      <SavedViewsBar entityKey="inventory" />
      <input
        ref={uploadRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importCsv(file);
        }}
      />
      <DataTable
        rows={rows}
        columns={columns}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        storageKey="inventory-table"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-[170px] bg-white">
                <SelectValue placeholder="Set status..." />
              </SelectTrigger>
              <SelectContent>
                {BULK_STATUSES.map((status) => (
                  <SelectItem value={status} key={status}>
                    {status.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={bulkUpdateStatus} disabled={loading}>
              <Wrench className="mr-2 h-4 w-4" />
              Bulk Update
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => uploadRef.current?.click()}>
              <FileUp className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <CreateVehicleDialog />
          </div>
        }
        rowActions={(row) => (
          <>
            <EntityDrawer
              title={`${row.year} ${row.make} ${row.model}`}
              description={`${row.stockNumber} • ${row.vin}`}
              trigger={
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              }
            >
              <div className="space-y-3 text-sm">
                <p className="text-slate-500">Status</p>
                <StatusBadge status={row.status} />
                <p className="text-slate-500">Price</p>
                <p className="font-medium text-slate-900">{formatCurrency(row.listPrice)}</p>
                <p className="text-slate-500">Recon Tasks</p>
                <p className="font-medium text-slate-900">{row.reconTasks.length}</p>
                <Button asChild className="w-full">
                  <Link href={`/inventory/${row.id}`}>Open Vehicle</Link>
                </Button>
              </div>
            </EntityDrawer>
            <Button asChild variant="outline" size="sm">
              <Link href={`/inventory/${row.id}`}>Open</Link>
            </Button>
          </>
        )}
      />
    </div>
  );
}

function CreateVehicleDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async (formData: FormData) => {
    setSaving(true);
    const payload = {
      vin: String(formData.get("vin") ?? ""),
      stockNumber: String(formData.get("stockNumber") ?? ""),
      year: Number(formData.get("year") ?? 0),
      make: String(formData.get("make") ?? ""),
      model: String(formData.get("model") ?? ""),
      trim: String(formData.get("trim") ?? ""),
      mileage: Number(formData.get("mileage") ?? 0),
      purchaseSource: String(formData.get("purchaseSource") ?? ""),
      listPrice: Number(formData.get("listPrice") ?? 0),
      minPrice: Number(formData.get("minPrice") ?? 0),
      location: String(formData.get("location") ?? ""),
      status: String(formData.get("status") ?? "ACQUIRED"),
    };
    const response = await fetch("/api/vehicles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Unable to create vehicle");
      return;
    }
    toast.success("Vehicle received");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Receive Vehicle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Vehicle</DialogTitle>
        </DialogHeader>
        <form action={create} className="grid gap-3 sm:grid-cols-2">
          <Input name="vin" placeholder="VIN" required />
          <Input name="stockNumber" placeholder="Stock #" required />
          <Input name="year" type="number" placeholder="Year" required />
          <Input name="make" placeholder="Make" required />
          <Input name="model" placeholder="Model" required />
          <Input name="trim" placeholder="Trim" />
          <Input name="mileage" type="number" placeholder="Mileage" required />
          <Input name="purchaseSource" placeholder="Purchase Source" />
          <Input name="listPrice" type="number" placeholder="List Price" required />
          <Input name="minPrice" type="number" placeholder="Min Price" />
          <Input name="location" placeholder="Location" />
          <select name="status" defaultValue="ACQUIRED" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            {BULK_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create Vehicle"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
