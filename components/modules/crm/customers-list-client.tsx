"use client";

import Link from "next/link";
import Papa from "papaparse";
import { Eye, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EntityDrawer } from "@/components/shared/entity-drawer";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { SavedViewsBar } from "@/components/tables/saved-views-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

type CustomerRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  createdAt: string | Date;
  leads: Array<{ id: string; stage: string }>;
  deals: Array<{ id: string; stage: string }>;
};

export function CustomersListClient({ rows }: { rows: CustomerRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  const columns = useMemo(
    () => [
      {
        key: "name",
        label: "Customer",
        render: (row: CustomerRow) => (
          <div>
            <p className="font-medium text-slate-900">
              {row.firstName} {row.lastName}
            </p>
            <p className="text-xs text-slate-500">{row.email ?? row.phone ?? "No contact info"}</p>
          </div>
        ),
      },
      {
        key: "location",
        label: "Location",
        render: (row: CustomerRow) => [row.city, row.state].filter(Boolean).join(", ") || "-",
      },
      {
        key: "leadCount",
        label: "Lead Stage",
        render: (row: CustomerRow) =>
          row.leads.length ? <StatusBadge status={row.leads[0].stage} /> : <span className="text-slate-500">No leads</span>,
      },
      {
        key: "dealCount",
        label: "Deals",
        render: (row: CustomerRow) => row.deals.length.toString(),
      },
      {
        key: "createdAt",
        label: "Created",
        render: (row: CustomerRow) => formatDate(row.createdAt),
      },
    ],
    [],
  );

  return (
    <div>
      <SavedViewsBar entityKey="customers" />
      <DataTable
        rows={rows}
        columns={columns}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        storageKey="customers-table"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedRows = rows.filter((row) => selected.includes(row.id));
                const csv = Papa.unparse(
                  selectedRows.map((row) => ({
                    id: row.id,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    email: row.email ?? "",
                    phone: row.phone ?? "",
                  })),
                );
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "customers-selected.csv";
                link.click();
                URL.revokeObjectURL(url);
              }}
              disabled={selected.length === 0}
            >
              Export Selected
            </Button>
            <CreateCustomerDialog />
          </div>
        }
        rowActions={(row) => (
          <>
            <EntityDrawer
              title={`${row.firstName} ${row.lastName}`}
              description={row.email ?? row.phone ?? "Customer"}
              trigger={
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              }
            >
              <div className="space-y-2 text-sm">
                <p className="text-slate-500">Lead History</p>
                {row.leads.map((lead) => (
                  <StatusBadge key={lead.id} status={lead.stage} />
                ))}
                <Button asChild className="w-full">
                  <Link href={`/crm/customers/${row.id}`}>Open Customer</Link>
                </Button>
              </div>
            </EntityDrawer>
            <Button asChild variant="outline" size="sm">
              <Link href={`/crm/customers/${row.id}`}>Open</Link>
            </Button>
          </>
        )}
      />
    </div>
  );
}

function CreateCustomerDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async (formData: FormData) => {
    setSaving(true);
    const payload = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Unable to create customer");
      return;
    }
    toast.success("Customer created");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <form action={create} className="grid gap-3 sm:grid-cols-2">
          <Input name="firstName" placeholder="First Name" required />
          <Input name="lastName" placeholder="Last Name" required />
          <Input name="email" type="email" placeholder="Email" />
          <Input name="phone" placeholder="Phone" />
          <Input name="city" placeholder="City" />
          <Input name="state" placeholder="State" />
          <Textarea name="notes" placeholder="Notes" className="sm:col-span-2" />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
