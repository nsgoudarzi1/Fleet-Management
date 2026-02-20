import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

type PartDetail = {
  id: string;
  partNumber: string;
  description: string;
  binLocation: string | null;
  onHandQty: string | number;
  reservedQty: string | number;
  reorderPoint: string | number;
  unitCost: string | number;
  unitPrice: string | number;
  vendor: { name: string } | null;
  transactions: Array<{
    id: string;
    type: string;
    quantity: string | number;
    unitCost: string | number;
    unitPrice: string | number;
    reason: string | null;
    reference: string | null;
    createdAt: string | Date;
  }>;
  repairLines: Array<{
    id: string;
    repairOrder: { id: string; roNumber: string; status: string };
    description: string;
    quantity: string | number;
    decision: string;
  }>;
};

export function PartDetailClient({ part }: { part: PartDetail }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <p className="text-xs text-slate-500">Part</p>
        <h1 className="text-2xl font-semibold text-slate-900">{part.partNumber} • {part.description}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vendor: {part.vendor?.name ?? "-"} • Bin: {part.binLocation ?? "-"}
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between"><span>On Hand</span><span className="font-semibold">{Number(part.onHandQty).toFixed(2)}</span></div>
            <div className="flex items-center justify-between"><span>Reserved</span><span className="font-semibold">{Number(part.reservedQty).toFixed(2)}</span></div>
            <div className="flex items-center justify-between"><span>Reorder Point</span><span className="font-semibold">{Number(part.reorderPoint).toFixed(2)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between"><span>Unit Cost</span><span className="font-semibold">{formatCurrency(part.unitCost)}</span></div>
            <div className="flex items-center justify-between"><span>Unit Price</span><span className="font-semibold">{formatCurrency(part.unitPrice)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>RO Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{part.repairLines.length} line items reference this part.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {part.transactions.map((tx) => (
            <div key={tx.id} className="rounded border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">{tx.type}</p>
                <p className="font-semibold">{Number(tx.quantity).toFixed(2)}</p>
              </div>
              <p className="text-xs text-slate-500">
                {formatDate(tx.createdAt, "MMM d, h:mm a")} • Cost {formatCurrency(tx.unitCost)} • Price {formatCurrency(tx.unitPrice)}
              </p>
              <p className="text-xs text-slate-500">{tx.reference ?? "No reference"} • {tx.reason ?? "No reason"}</p>
            </div>
          ))}
          {part.transactions.length === 0 ? <p className="text-sm text-slate-500">No transactions recorded.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Repair Order Lines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {part.repairLines.map((line) => (
            <div key={line.id} className="rounded border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-900">{line.repairOrder.roNumber} • {line.description}</p>
              <p className="text-xs text-slate-500">
                Qty {Number(line.quantity).toFixed(2)} • {line.decision} • {line.repairOrder.status}
              </p>
            </div>
          ))}
          {part.repairLines.length === 0 ? <p className="text-sm text-slate-500">No repair-order usage yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
