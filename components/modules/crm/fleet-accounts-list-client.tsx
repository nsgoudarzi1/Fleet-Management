"use client";

import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EntityDrawer } from "@/components/shared/entity-drawer";
import { DataTable } from "@/components/tables/data-table";
import { SavedViewsBar } from "@/components/tables/saved-views-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FleetAccountRow = {
  id: string;
  name: string;
  billingTerms: string | null;
  taxExempt: boolean;
  memberships: Array<{ id: string }>;
  quotes: Array<{ id: string; status: string }>;
  createdAt: string | Date;
};

export function FleetAccountsListClient({ rows }: { rows: FleetAccountRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const columns = useMemo(
    () => [
      {
        key: "name",
        label: "Fleet Account",
        render: (row: FleetAccountRow) => (
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            <p className="text-xs text-slate-500">{row.billingTerms ?? "No billing terms set"}</p>
          </div>
        ),
      },
      {
        key: "members",
        label: "Members",
        render: (row: FleetAccountRow) => row.memberships.length.toString(),
      },
      {
        key: "quotes",
        label: "Quotes",
        render: (row: FleetAccountRow) => row.quotes.length.toString(),
      },
      {
        key: "taxExempt",
        label: "Tax",
        render: (row: FleetAccountRow) => (row.taxExempt ? "Exempt" : "Standard"),
      },
    ],
    [],
  );

  const createFleetAccount = async (formData: FormData) => {
    setSaving(true);
    const response = await fetch("/api/fleet-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        billingTerms: String(formData.get("billingTerms") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        taxExempt: formData.get("taxExempt") === "on",
        locations: String(formData.get("locations") ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    setSaving(false);
    if (!response.ok) return;
    window.location.reload();
  };

  return (
    <div>
      <SavedViewsBar entityKey="fleet-accounts" />
      <DataTable
        rows={rows}
        columns={columns}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        storageKey="fleet-accounts-table"
        actions={
          <EntityDrawer
            title="New Fleet Account"
            description="Track locations, billing terms, and linked customer records."
            trigger={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Fleet Account
              </Button>
            }
          >
            <form action={createFleetAccount} className="space-y-3">
              <Input name="name" placeholder="Fleet name" required />
              <Input name="billingTerms" placeholder="Billing terms (e.g., Net 30)" />
              <Input name="locations" placeholder="Locations (comma separated)" />
              <Input name="notes" placeholder="Notes" />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="taxExempt" />
                Tax exempt account
              </label>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : "Create"}
              </Button>
            </form>
          </EntityDrawer>
        }
        rowActions={(row) => (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/crm/fleet/${row.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/crm/fleet/${row.id}`}>Open</Link>
            </Button>
          </>
        )}
      />
    </div>
  );
}
