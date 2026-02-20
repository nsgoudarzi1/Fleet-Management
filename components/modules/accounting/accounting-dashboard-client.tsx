"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/data-table";
import { SavedViewsBar } from "@/components/tables/saved-views-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";

type PaymentRow = {
  id: string;
  amount: string | number;
  method: string;
  reference: string | null;
  postedAt: string | Date;
  deal: { id: string; dealNumber: string } | null;
  customer: { id: string; firstName: string; lastName: string } | null;
  createdBy: { id: string; name: string | null } | null;
};

type Option = {
  id: string;
  label: string;
};

type AccountingDashboardClientProps = {
  payments: PaymentRow[];
  dealOptions: Option[];
  customerOptions: Option[];
  salesLog: Array<{
    id: string;
    dealNumber: string;
    stage: string;
    salePrice: string | number;
    customer: { firstName: string; lastName: string };
    vehicle: { stockNumber: string };
    createdAt: string | Date;
  }>;
  inventoryAging: Array<{
    id: string;
    stockNumber: string;
    make: string;
    model: string;
    acquiredAt: string | Date;
    ageDays: number;
    status: string;
  }>;
  reconSpendSummary: Array<{
    vehicleId: string;
    stockNumber: string;
    total: number;
  }>;
};

export function AccountingDashboardClient({
  payments,
  dealOptions,
  customerOptions,
  salesLog,
  inventoryAging,
  reconSpendSummary,
}: AccountingDashboardClientProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const paymentColumns = useMemo(
    () => [
      {
        key: "postedAt",
        label: "Posted",
        render: (row: PaymentRow) => formatDate(row.postedAt, "MMM d, h:mm a"),
      },
      {
        key: "amount",
        label: "Amount",
        render: (row: PaymentRow) => formatCurrency(row.amount),
      },
      {
        key: "method",
        label: "Method",
      },
      {
        key: "reference",
        label: "Reference",
      },
      {
        key: "deal",
        label: "Deal",
        render: (row: PaymentRow) => row.deal?.dealNumber ?? "-",
      },
      {
        key: "customer",
        label: "Customer",
        render: (row: PaymentRow) =>
          row.customer ? `${row.customer.firstName} ${row.customer.lastName}` : "-",
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <SavedViewsBar entityKey="accounting" />
      <DataTable
        rows={payments}
        columns={paymentColumns}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        storageKey="payments-table"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selected.length === 0}
              onClick={async () => {
                await Promise.all(
                  selected.map((id) =>
                    fetch(`/api/payments/${id}`, {
                      method: "DELETE",
                    }),
                  ),
                );
                toast.success(`Removed ${selected.length} payments`);
                window.location.reload();
              }}
            >
              Bulk Delete
            </Button>
            <CreatePaymentDialog dealOptions={dealOptions} customerOptions={customerOptions} />
          </div>
        }
      />
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Sales Log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {salesLog.map((deal) => (
              <div key={deal.id} className="grid grid-cols-[1fr_auto] gap-2 rounded border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {deal.dealNumber} • {deal.customer.firstName} {deal.customer.lastName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {deal.vehicle.stockNumber} • {deal.stage} • {formatDate(deal.createdAt)}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(deal.salePrice)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recon Spend Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reconSpendSummary.map((row) => (
              <div key={row.vehicleId} className="flex items-center justify-between rounded border border-slate-200 p-3 text-sm">
                <span>{row.stockNumber}</span>
                <span className="font-semibold">{formatCurrency(row.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Inventory Aging</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {inventoryAging.map((row) => {
            const days = row.ageDays;
            return (
              <div key={row.id} className="flex items-center justify-between rounded border border-slate-200 p-3 text-sm">
                <p>
                  {row.stockNumber} • {row.make} {row.model}
                </p>
                <p className={days > 45 ? "font-semibold text-red-600" : "font-semibold text-slate-700"}>
                  {days} days ({row.status})
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function CreatePaymentDialog({
  dealOptions,
  customerOptions,
}: {
  dealOptions: Option[];
  customerOptions: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const createPayment = async (formData: FormData) => {
    setSaving(true);
    const payload = {
      dealId: String(formData.get("dealId") ?? "") || undefined,
      customerId: String(formData.get("customerId") ?? "") || undefined,
      amount: Number(formData.get("amount") ?? 0),
      method: String(formData.get("method") ?? "CASH"),
      reference: String(formData.get("reference") ?? ""),
      postedAt: formData.get("postedAt") ? new Date(String(formData.get("postedAt"))).toISOString() : undefined,
      notes: String(formData.get("notes") ?? ""),
    };
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Unable to record payment");
      return;
    }
    toast.success("Payment recorded");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Record Payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form action={createPayment} className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Deal</span>
            <select name="dealId" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="">No deal</option>
              {dealOptions.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>Customer</span>
            <select name="customerId" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="">No customer</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.label}
                </option>
              ))}
            </select>
          </label>
          <Input name="amount" type="number" placeholder="Amount" required />
          <label className="space-y-1 text-sm">
            <span>Method</span>
            <select name="method" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="CASH">CASH</option>
              <option value="ACH">ACH</option>
              <option value="CREDIT_CARD">CREDIT CARD</option>
              <option value="CHECK">CHECK</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
          <Input name="reference" placeholder="Reference #" />
          <Input name="postedAt" type="datetime-local" />
          <textarea
            name="notes"
            placeholder="Notes"
            className="sm:col-span-2 min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
