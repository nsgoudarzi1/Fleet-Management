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

type QuoteRow = {
  id: string;
  quoteNumber: string;
  status: string;
  total: string | number;
  grossTotal: string | number;
  expiresAt: string | Date | null;
  createdAt: string | Date;
  customer: { firstName: string; lastName: string } | null;
  fleetAccount: { name: string } | null;
  lines: Array<{ id: string }>;
};

export function QuotesListClient({ rows }: { rows: QuoteRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("SENT");

  const columns = useMemo(
    () => [
      {
        key: "quote",
        label: "Quote",
        render: (row: QuoteRow) => (
          <div>
            <p className="font-medium text-slate-900">{row.quoteNumber}</p>
            <p className="text-xs text-slate-500">{formatDate(row.createdAt)}</p>
          </div>
        ),
      },
      {
        key: "account",
        label: "Customer / Fleet",
        render: (row: QuoteRow) => {
          if (row.fleetAccount) return row.fleetAccount.name;
          if (row.customer) return `${row.customer.firstName} ${row.customer.lastName}`;
          return "Unassigned";
        },
      },
      {
        key: "lines",
        label: "Lines",
        render: (row: QuoteRow) => row.lines.length.toString(),
      },
      {
        key: "status",
        label: "Status",
        render: (row: QuoteRow) => <StatusBadge status={row.status} />,
      },
      {
        key: "total",
        label: "Total",
        align: "right" as const,
        render: (row: QuoteRow) => formatCurrency(row.total),
      },
      {
        key: "gross",
        label: "Gross",
        align: "right" as const,
        render: (row: QuoteRow) => formatCurrency(row.grossTotal),
      },
      {
        key: "expiresAt",
        label: "Expires",
        render: (row: QuoteRow) => (row.expiresAt ? formatDate(row.expiresAt) : "-"),
      },
    ],
    [],
  );

  const createQuote = async (formData: FormData) => {
    setSaving(true);
    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: String(formData.get("customerId") ?? "") || undefined,
        fleetAccountId: String(formData.get("fleetAccountId") ?? "") || undefined,
        expiresAt: formData.get("expiresAt")
          ? new Date(String(formData.get("expiresAt"))).toISOString()
          : undefined,
        notes: String(formData.get("notes") ?? ""),
      }),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Unable to create quote");
      return;
    }
    const payload = await response.json();
    window.location.href = `/quotes/${payload.data.id}`;
  };

  const bulkUpdateStatus = async () => {
    if (!selected.length) return;
    await Promise.all(
      selected.map((quoteId) =>
        fetch(`/api/quotes/${quoteId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: bulkStatus }),
        }),
      ),
    );
    window.location.reload();
  };

  return (
    <div>
      <SavedViewsBar entityKey="quotes" />
      <DataTable
        rows={rows}
        columns={columns}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        storageKey="quotes-table"
        actions={
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value)}
            >
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <Button size="sm" variant="outline" onClick={bulkUpdateStatus} disabled={!selected.length}>
              Update Selected
            </Button>
            <EntityDrawer
              title="Create Quote"
              description="Build a multi-unit quote and add line items from quote detail."
              trigger={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Quote
                </Button>
              }
            >
              <form action={createQuote} className="space-y-3">
                <Input name="customerId" placeholder="Customer ID (optional)" />
                <Input name="fleetAccountId" placeholder="Fleet Account ID (optional)" />
                <Input name="expiresAt" type="datetime-local" />
                <Input name="notes" placeholder="Internal notes" />
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Creating..." : "Create Quote"}
                </Button>
              </form>
            </EntityDrawer>
          </div>
        }
        rowActions={(row) => (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/quotes/${row.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/quotes/${row.id}`}>Open</Link>
            </Button>
          </>
        )}
      />
    </div>
  );
}
