"use client";

import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EntityDrawer } from "@/components/shared/entity-drawer";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { SavedViewsBar } from "@/components/tables/saved-views-bar";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

type DealRow = {
  id: string;
  dealNumber: string;
  stage: string;
  fundingStatus: string;
  salePrice: string | number;
  monthlyPayment: string | number;
  createdAt: string | Date;
  customer: { firstName: string; lastName: string };
  vehicle: { stockNumber: string; year: number; make: string; model: string };
};

export function DealsListClient({ rows }: { rows: DealRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStage, setBulkStage] = useState("SUBMITTED");

  const columns = useMemo(
    () => [
      {
        key: "deal",
        label: "Deal",
        render: (row: DealRow) => (
          <div>
            <p className="font-medium text-slate-900">{row.dealNumber}</p>
            <p className="text-xs text-slate-500">{formatDate(row.createdAt)}</p>
          </div>
        ),
      },
      {
        key: "customer",
        label: "Customer",
        render: (row: DealRow) => `${row.customer.firstName} ${row.customer.lastName}`,
      },
      {
        key: "vehicle",
        label: "Vehicle",
        render: (row: DealRow) => `${row.vehicle.stockNumber} - ${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}`,
      },
      {
        key: "stage",
        label: "Stage",
        render: (row: DealRow) => <StatusBadge status={row.stage} />,
      },
      {
        key: "salePrice",
        label: "Sale Price",
        render: (row: DealRow) => formatCurrency(row.salePrice),
      },
      {
        key: "monthlyPayment",
        label: "Monthly",
        render: (row: DealRow) => formatCurrency(row.monthlyPayment),
      },
      {
        key: "fundingStatus",
        label: "Funding",
        render: (row: DealRow) => <StatusBadge status={row.fundingStatus} />,
      },
    ],
    [],
  );

  return (
    <div>
      <SavedViewsBar entityKey="deals" />
      <DataTable
        rows={rows}
        columns={columns}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        storageKey="deals-table"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={bulkStage}
              onChange={(event) => setBulkStage(event.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="CONTRACTED">Contracted</option>
              <option value="DELIVERED">Delivered</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selected.length === 0}
              onClick={async () => {
                await Promise.all(
                  selected.map((dealId) =>
                    fetch("/api/deals/stage", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ dealId, stage: bulkStage }),
                    }),
                  ),
                );
                window.location.reload();
              }}
            >
              Update Selected Stage
            </Button>
            <Button asChild size="sm">
              <Link href="/deals/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Deal
              </Link>
            </Button>
          </div>
        }
        rowActions={(row) => (
          <>
            <EntityDrawer
              title={row.dealNumber}
              description={`${row.customer.firstName} ${row.customer.lastName}`}
              trigger={
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              }
            >
              <div className="space-y-2 text-sm">
                <StatusBadge status={row.stage} />
                <p>{row.vehicle.year} {row.vehicle.make} {row.vehicle.model}</p>
                <p>Sale: {formatCurrency(row.salePrice)}</p>
                <Button asChild className="w-full">
                  <Link href={`/deals/${row.id}`}>Open Deal</Link>
                </Button>
              </div>
            </EntityDrawer>
            <Button asChild variant="outline" size="sm">
              <Link href={`/deals/${row.id}`}>Open</Link>
            </Button>
          </>
        )}
      />
    </div>
  );
}

