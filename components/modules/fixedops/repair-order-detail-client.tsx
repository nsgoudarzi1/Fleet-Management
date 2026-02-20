"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CircleDollarSign, Plus } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";

type Option = { id: string; label: string };

type RepairOrderDetail = {
  id: string;
  roNumber: string;
  status: string;
  customerNotes: string | null;
  internalNotes: string | null;
  subtotalLabor: string | number;
  subtotalParts: string | number;
  subtotalSublet: string | number;
  subtotalFees: string | number;
  taxTotal: string | number;
  grandTotal: string | number;
  createdAt: string | Date;
  customer: { firstName: string; lastName: string; id: string };
  vehicle: { year: number; make: string; model: string; stockNumber: string; id: string };
  lines: Array<{
    id: string;
    lineNumber: number;
    type: string;
    description: string;
    decision: string;
    quantity: string | number;
    unitPrice: string | number;
    unitCost: string | number;
    taxable: boolean;
    partId: string | null;
    technicianId: string | null;
    part: { id: string; partNumber: string; description: string } | null;
    technician: { id: string; displayName: string } | null;
  }>;
  timePunches: Array<{
    id: string;
    clockInAt: string | Date;
    clockOutAt: string | Date | null;
    minutesWorked: number;
    technician: { id: string; displayName: string };
  }>;
  partTransactions: Array<{
    id: string;
    type: string;
    quantity: string | number;
    createdAt: string | Date;
    part: { id: string; partNumber: string; description: string };
    reason: string | null;
  }>;
};

const STATUS_FLOW = ["OPEN", "IN_PROGRESS", "AWAITING_APPROVAL", "COMPLETED", "CLOSED_INVOICED"];

export function RepairOrderDetailClient({
  repairOrder,
  partOptions,
  technicianOptions,
}: {
  repairOrder: RepairOrderDetail;
  partOptions: Option[];
  technicianOptions: Option[];
}) {
  const [savingLine, setSavingLine] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [allocatingLineId, setAllocatingLineId] = useState<string | null>(null);

  const totals = useMemo(
    () => [
      { label: "Labor", value: repairOrder.subtotalLabor },
      { label: "Parts", value: repairOrder.subtotalParts },
      { label: "Sublet", value: repairOrder.subtotalSublet },
      { label: "Fees", value: repairOrder.subtotalFees },
      { label: "Tax", value: repairOrder.taxTotal },
      { label: "Grand Total", value: repairOrder.grandTotal },
    ],
    [repairOrder],
  );

  const addLine = async (formData: FormData) => {
    setSavingLine(true);
    const payload = {
      type: String(formData.get("type") ?? "LABOR"),
      description: String(formData.get("description") ?? ""),
      operationCode: String(formData.get("operationCode") ?? "") || undefined,
      partId: String(formData.get("partId") ?? "") || undefined,
      technicianId: String(formData.get("technicianId") ?? "") || undefined,
      quantity: Number(formData.get("quantity") ?? 1),
      flatRateHours: Number(formData.get("flatRateHours") ?? 0),
      actualHours: Number(formData.get("actualHours") ?? 0),
      unitCost: Number(formData.get("unitCost") ?? 0),
      unitPrice: Number(formData.get("unitPrice") ?? 0),
      taxable: formData.get("taxable") === "on",
      decision: String(formData.get("decision") ?? "RECOMMENDED"),
      notes: String(formData.get("notes") ?? "") || undefined,
    };

    const response = await fetch(`/api/fixedops/repair-orders/${repairOrder.id}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingLine(false);

    if (!response.ok) {
      toast.error("Unable to add line item.");
      return;
    }

    toast.success("Line item added.");
    window.location.reload();
  };

  const setLineDecision = async (lineId: string, decision: "APPROVED" | "DECLINED" | "RECOMMENDED") => {
    const response = await fetch(`/api/fixedops/repair-orders/${repairOrder.id}/line-decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineId, decision }),
    });

    if (!response.ok) {
      toast.error("Unable to update line decision.");
      return;
    }

    toast.success("Line decision updated.");
    window.location.reload();
  };

  const allocatePart = async (lineId: string, partId: string, quantity: number) => {
    setAllocatingLineId(lineId);
    const response = await fetch("/api/fixedops/parts/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partId,
        repairOrderId: repairOrder.id,
        lineId,
        quantity,
      }),
    });
    setAllocatingLineId(null);

    if (!response.ok) {
      toast.error("Unable to allocate part.");
      return;
    }

    toast.success("Part allocated to repair order.");
    window.location.reload();
  };

  const updateStatus = async (status: string) => {
    setUpdatingStatus(true);
    const payload: {
      repairOrderId: string;
      status: string;
      paymentMethod?: "CASH" | "ACH" | "CREDIT_CARD" | "CHECK" | "OTHER";
      paymentReference?: string;
    } = {
      repairOrderId: repairOrder.id,
      status,
    };

    if (status === "CLOSED_INVOICED") {
      const takePayment = window.confirm("Record payment at close?");
      if (takePayment) {
        const method = (window.prompt("Payment method (CASH, ACH, CREDIT_CARD, CHECK, OTHER):", "CASH") ?? "CASH")
          .trim()
          .toUpperCase();
        payload.paymentMethod = (method as typeof payload.paymentMethod) ?? "CASH";
        payload.paymentReference = window.prompt("Payment reference (optional):") ?? undefined;
      }
    }

    const response = await fetch("/api/fixedops/repair-orders/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setUpdatingStatus(false);
    if (!response.ok) {
      toast.error("Unable to update repair order status.");
      return;
    }

    toast.success("Repair order status updated.");
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <p className="text-xs text-slate-500">Repair Order</p>
        <h1 className="text-2xl font-semibold text-slate-900">{repairOrder.roNumber}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={repairOrder.status} />
          <p className="text-sm text-slate-500">
            {repairOrder.customer.firstName} {repairOrder.customer.lastName} • {repairOrder.vehicle.year} {repairOrder.vehicle.make} {repairOrder.vehicle.model}
          </p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {repairOrder.lines.map((line) => (
                <div key={line.id} className="rounded border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">#{line.lineNumber} {line.description}</p>
                      <p className="text-xs text-slate-500">
                        {line.type} • Qty {Number(line.quantity).toFixed(2)} • {formatCurrency(Number(line.unitPrice) * Number(line.quantity))}
                      </p>
                      <p className="text-xs text-slate-500">
                        {line.part ? `${line.part.partNumber} ${line.part.description}` : "No part"} • {line.technician?.displayName ?? "Unassigned tech"}
                      </p>
                    </div>
                    <StatusBadge status={line.decision} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void setLineDecision(line.id, "APPROVED")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => void setLineDecision(line.id, "DECLINED")}>Decline</Button>
                    <Button size="sm" variant="outline" onClick={() => void setLineDecision(line.id, "RECOMMENDED")}>Recommend</Button>
                    {line.type === "PART" && line.partId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={allocatingLineId === line.id}
                        onClick={() => void allocatePart(line.id, line.partId!, Number(line.quantity))}
                      >
                        {allocatingLineId === line.id ? "Allocating..." : "Allocate Part"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              {repairOrder.lines.length === 0 ? <p className="text-sm text-slate-500">No line items added yet.</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Line Item</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addLine} className="grid gap-2 sm:grid-cols-2">
                <select name="type" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="LABOR">LABOR</option>
                  <option value="PART">PART</option>
                  <option value="SUBLET">SUBLET</option>
                  <option value="FEE">FEE</option>
                </select>
                <select name="decision" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="RECOMMENDED">RECOMMENDED</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="DECLINED">DECLINED</option>
                </select>
                <Input name="description" placeholder="Description" className="sm:col-span-2" required />
                <Input name="operationCode" placeholder="Operation code" />
                <select name="technicianId" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="">No technician</option>
                  {technicianOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <select name="partId" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm sm:col-span-2">
                  <option value="">No part</option>
                  {partOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <Input name="quantity" type="number" step="0.01" defaultValue={1} placeholder="Quantity" />
                <Input name="unitPrice" type="number" step="0.01" placeholder="Unit price" defaultValue={0} />
                <Input name="unitCost" type="number" step="0.01" placeholder="Unit cost" defaultValue={0} />
                <Input name="flatRateHours" type="number" step="0.01" defaultValue={0} placeholder="Flat-rate hours" />
                <Input name="actualHours" type="number" step="0.01" defaultValue={0} placeholder="Actual hours" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="taxable" defaultChecked />
                  Taxable
                </label>
                <Textarea name="notes" placeholder="Notes" className="sm:col-span-2" />
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" disabled={savingLine}>
                    <Plus className="mr-2 h-4 w-4" />
                    {savingLine ? "Adding..." : "Add Line"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {repairOrder.partTransactions.map((transaction) => (
                <div key={transaction.id} className="rounded border border-slate-200 p-2 text-sm">
                  <p className="font-medium">{transaction.type} {transaction.part.partNumber}</p>
                  <p className="text-xs text-slate-500">
                    Qty {Number(transaction.quantity).toFixed(2)} • {formatDate(transaction.createdAt, "MMM d, h:mm a")} • {transaction.reason ?? "No reason"}
                  </p>
                </div>
              ))}
              {repairOrder.partTransactions.length === 0 ? <p className="text-sm text-slate-500">No part transactions.</p> : null}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status Flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {STATUS_FLOW.map((status) => (
                <Button
                  key={status}
                  variant={status === repairOrder.status ? "default" : "outline"}
                  className="w-full justify-between"
                  disabled={updatingStatus}
                  onClick={() => void updateStatus(status)}
                >
                  {status.replaceAll("_", " ")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {totals.map((total) => (
                <div key={total.label} className="flex items-center justify-between">
                  <span className="text-slate-600">{total.label}</span>
                  <span className="font-medium text-slate-900">{formatCurrency(total.value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tech Time Punches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {repairOrder.timePunches.map((punch) => (
                <div key={punch.id} className="rounded border border-slate-200 p-2 text-sm">
                  <p className="font-medium">{punch.technician.displayName}</p>
                  <p className="text-xs text-slate-500">{formatDate(punch.clockInAt, "MMM d, h:mm a")} - {punch.clockOutAt ? formatDate(punch.clockOutAt, "h:mm a") : "Clocked in"}</p>
                  <p className="text-xs text-slate-500">{punch.minutesWorked} minutes</p>
                </div>
              ))}
              {repairOrder.timePunches.length === 0 ? <p className="text-sm text-slate-500">No punches logged yet.</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Facts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-slate-600">
              <p>Created: {formatDate(repairOrder.createdAt, "MMM d, yyyy h:mm a")}</p>
              <p>Vehicle: {repairOrder.vehicle.stockNumber}</p>
              <p>Customer Notes: {repairOrder.customerNotes ?? "-"}</p>
              <p>Internal Notes: {repairOrder.internalNotes ?? "-"}</p>
              <p className="inline-flex items-center gap-1 pt-2 font-medium text-slate-900"><CircleDollarSign className="h-4 w-4" />Close RO posts to journal</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
