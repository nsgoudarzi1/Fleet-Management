"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

type QuoteDetail = {
  id: string;
  quoteNumber: string;
  status: string;
  expiresAt: string | Date | null;
  subtotal: string | number;
  taxTotal: string | number;
  total: string | number;
  costTotal: string | number;
  grossTotal: string | number;
  customer: { firstName: string; lastName: string } | null;
  fleetAccount: { id: string; name: string } | null;
  lines: Array<{
    id: string;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    taxable: boolean;
    lineTotal: string | number;
    lineGross: string | number;
    vehicle: { id: string; stockNumber: string; year: number; make: string; model: string } | null;
  }>;
  approvals: Array<{
    id: string;
    status: string;
    reason: string;
    delta: string | number;
    createdAt: string | Date;
  }>;
  upfitJobs: Array<{
    id: string;
    status: string;
    costEstimate: string | number;
    actualCost: string | number;
    vendor: { name: string } | null;
    milestones: Array<{ id: string; name: string; completedAt: string | Date | null }>;
  }>;
};

export function QuoteDetailClient({ quote }: { quote: QuoteDetail }) {
  const [addingLine, setAddingLine] = useState(false);
  const [sharing, setSharing] = useState(false);

  const addLine = async (formData: FormData) => {
    setAddingLine(true);
    const response = await fetch(`/api/quotes/${quote.id}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: String(formData.get("vehicleId") ?? "") || undefined,
        description: String(formData.get("description") ?? ""),
        quantity: Number(formData.get("quantity") ?? 1),
        unitPrice: Number(formData.get("unitPrice") ?? 0),
        taxable: formData.get("taxable") === "on",
        unitCost: Number(formData.get("unitCost") ?? 0),
      }),
    });
    setAddingLine(false);
    if (!response.ok) {
      toast.error("Unable to add quote line");
      return;
    }
    window.location.reload();
  };

  const removeLine = async (lineId: string) => {
    const response = await fetch(`/api/quotes/${quote.id}/lines`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineId }),
    });
    if (!response.ok) {
      toast.error("Unable to remove line");
      return;
    }
    window.location.reload();
  };

  const setStatus = async (status: string) => {
    const response = await fetch(`/api/quotes/${quote.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      toast.error("Unable to update quote status");
      return;
    }
    window.location.reload();
  };

  const createShareLink = async () => {
    setSharing(true);
    const response = await fetch(`/api/quotes/${quote.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setSharing(false);
    if (!response.ok) {
      toast.error("Unable to create share link");
      return;
    }
    const payload = await response.json();
    const origin = window.location.origin;
    await navigator.clipboard.writeText(`${origin}${payload.data.sharePath}`);
    toast.success("Share link copied");
  };

  const requestApproval = async (formData: FormData) => {
    const response = await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "Quote",
        entityId: quote.id,
        quoteId: quote.id,
        reason: String(formData.get("reason") ?? ""),
        delta: Number(formData.get("delta") ?? 0),
      }),
    });
    if (!response.ok) {
      toast.error("Unable to request approval");
      return;
    }
    toast.success("Approval request submitted");
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-slate-500">Quote {quote.quoteNumber}</p>
            <h1 className="text-2xl font-semibold text-slate-900">
              {quote.fleetAccount?.name ?? quote.customer ? `${quote.customer?.firstName ?? ""} ${quote.customer?.lastName ?? ""}`.trim() : "Quote"}
            </h1>
            <p className="text-sm text-slate-500">
              Expires {quote.expiresAt ? formatDate(quote.expiresAt, "MMM d, yyyy") : "Not set"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={quote.status} />
            <Button variant="outline" size="sm" onClick={() => void setStatus("SENT")}>Mark Sent</Button>
            <Button variant="outline" size="sm" onClick={() => void setStatus("ACCEPTED")}>Mark Accepted</Button>
            <Button size="sm" onClick={() => void createShareLink()} disabled={sharing}>
              {sharing ? "Sharing..." : "Share Link"}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">Generate PDF</a>
            </Button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Quote Lines</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="upfits">Upfits</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Add Line Item</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addLine} className="grid gap-2 sm:grid-cols-6">
                <Input className="sm:col-span-2" name="description" placeholder="Description" required />
                <Input name="vehicleId" placeholder="Vehicle ID (optional)" />
                <Input name="quantity" type="number" defaultValue={1} />
                <Input name="unitPrice" type="number" placeholder="Unit Price" />
                <Input name="unitCost" type="number" placeholder="Unit Cost" />
                <label className="sm:col-span-6 flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" name="taxable" defaultChecked />
                  Taxable
                </label>
                <div className="sm:col-span-6 flex justify-end">
                  <Button type="submit" disabled={addingLine}>{addingLine ? "Adding..." : "Add Line"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quote.lines.length === 0 ? <p className="text-sm text-slate-500">No lines added.</p> : null}
              {quote.lines.map((line) => (
                <div key={line.id} className="rounded border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{line.description}</p>
                      {line.vehicle ? (
                        <p className="text-xs text-slate-500">
                          <Link href={`/inventory/${line.vehicle.id}`} className="hover:underline">
                            {line.vehicle.stockNumber} - {line.vehicle.year} {line.vehicle.make} {line.vehicle.model}
                          </Link>
                        </p>
                      ) : null}
                      <p className="text-xs text-slate-500">
                        Qty {line.quantity} • Unit {formatCurrency(line.unitPrice)} • {line.taxable ? "Taxable" : "Non-taxable"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-900">{formatCurrency(line.lineTotal)}</p>
                      <p className="text-xs text-slate-500">Gross {formatCurrency(line.lineGross)}</p>
                      <Button variant="ghost" size="sm" onClick={() => void removeLine(line.id)}>Remove</Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <p className="text-sm text-slate-500">Subtotal</p>
              <p className="text-right text-sm font-medium">{formatCurrency(quote.subtotal)}</p>
              <p className="text-sm text-slate-500">Tax</p>
              <p className="text-right text-sm font-medium">{formatCurrency(quote.taxTotal)}</p>
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-right text-sm font-medium">{formatCurrency(quote.total)}</p>
              <p className="text-sm text-slate-500">Gross</p>
              <p className="text-right text-sm font-medium">{formatCurrency(quote.grossTotal)}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Request Discount Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={requestApproval} className="grid gap-2 sm:grid-cols-2">
                <Input name="delta" type="number" placeholder="Delta amount (negative for discount)" required />
                <Input name="reason" placeholder="Reason" required />
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit">Request Approval</Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Approval Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quote.approvals.length === 0 ? <p className="text-sm text-slate-500">No approval requests.</p> : null}
              {quote.approvals.map((approval) => (
                <div key={approval.id} className="rounded border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{approval.reason}</p>
                    <StatusBadge status={approval.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    Delta {formatCurrency(approval.delta)} • {formatDate(approval.createdAt)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upfits">
          <Card>
            <CardHeader>
              <CardTitle>Upfit Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quote.upfitJobs.length === 0 ? <p className="text-sm text-slate-500">No upfit jobs linked to this quote.</p> : null}
              {quote.upfitJobs.map((job) => (
                <div key={job.id} className="rounded border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{job.vendor?.name ?? "Unassigned Vendor"}</p>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    Estimate {formatCurrency(job.costEstimate)} • Actual {formatCurrency(job.actualCost)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Milestones: {job.milestones.filter((item) => !!item.completedAt).length}/{job.milestones.length}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
