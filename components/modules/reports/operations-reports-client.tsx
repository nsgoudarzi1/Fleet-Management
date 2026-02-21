"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";

type OperationsReport = {
  inventoryAgingBuckets: Record<string, number>;
  inventoryAging: Array<{
    id: string;
    stockNumber: string;
    status: string;
    agingDays: number;
  }>;
  quoteAging: Array<{
    id: string;
    quoteNumber: string;
    status: string;
    agingDays: number;
    followUpDue: boolean;
  }>;
  fundingAging: Array<{
    id: string;
    dealId: string;
    dealNumber: string;
    customerName: string;
    status: string;
    agingDays: number;
    nextActionAt: string | Date | null;
  }>;
  upfitAging: Array<{
    id: string;
    status: string;
    agingDays: number;
    deal: { id: string; dealNumber: string } | null;
    quote: { id: string; quoteNumber: string } | null;
    vehicle: { id: string; stockNumber: string } | null;
  }>;
  checklistExceptions: Array<{
    id: string;
    dealId: string;
    dealNumber: string;
    packName: string;
    documentType: string;
    status: string;
    blocking: boolean;
    createdAt: string | Date;
  }>;
  exceptions: {
    negativeGrossQuotes: Array<{ id: string; quoteNumber: string; grossTotal: string | number }>;
    pendingApprovals: Array<{ id: string; entityType: string; delta: string | number; status: string }>;
    unapprovedDiscounts: Array<{ id: string; entityType: string; delta: string | number; status: string }>;
  };
};

export function OperationsReportsClient({ report }: { report: OperationsReport }) {
  return (
    <Tabs defaultValue="aging">
      <TabsList>
        <TabsTrigger value="aging">Aging</TabsTrigger>
        <TabsTrigger value="documents">Document Exceptions</TabsTrigger>
        <TabsTrigger value="financial">Financial Exceptions</TabsTrigger>
      </TabsList>

      <TabsContent value="aging" className="space-y-4">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(report.inventoryAgingBuckets).map(([bucket, count]) => (
            <Card key={bucket}>
              <CardHeader>
                <CardTitle className="text-sm">{bucket} days</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-slate-900">{count}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quote Aging</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {report.quoteAging.slice(0, 20).map((quote) => (
                <div key={quote.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
                  <div>
                    <Link href={`/quotes/${quote.id}`} className="font-medium text-slate-900 hover:underline">{quote.quoteNumber}</Link>
                    <p className="text-xs text-slate-500">{quote.agingDays} days old</p>
                  </div>
                  <StatusBadge status={quote.status} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upfit Aging</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {report.upfitAging.slice(0, 20).map((upfit) => (
                <div key={upfit.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
                  <div>
                    <p className="font-medium text-slate-900">{upfit.vehicle?.stockNumber ?? upfit.deal?.dealNumber ?? upfit.quote?.quoteNumber ?? "Upfit Job"}</p>
                    <p className="text-xs text-slate-500">{upfit.agingDays} days old</p>
                  </div>
                  <StatusBadge status={upfit.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </TabsContent>

      <TabsContent value="documents">
        <Card>
          <CardHeader>
            <CardTitle>Document Pack Missing / Blocked</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {report.checklistExceptions.length === 0 ? <p className="text-slate-500">No document checklist exceptions.</p> : null}
            {report.checklistExceptions.slice(0, 50).map((item) => (
              <div key={item.id} className="rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/deals/${item.dealId}`} className="font-medium text-slate-900 hover:underline">{item.dealNumber}</Link>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-xs text-slate-500">
                  {item.packName} • {item.documentType} • {item.blocking ? "Blocking" : "Non-blocking"} • {formatDate(item.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="financial">
        <section className="grid gap-3 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Negative Gross Quotes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {report.exceptions.negativeGrossQuotes.map((quote) => (
                <div key={quote.id} className="rounded border border-slate-200 p-3">
                  <Link href={`/quotes/${quote.id}`} className="font-medium text-slate-900 hover:underline">{quote.quoteNumber}</Link>
                </div>
              ))}
              {report.exceptions.negativeGrossQuotes.length === 0 ? <p className="text-slate-500">No negative gross quotes.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {report.exceptions.pendingApprovals.map((approval) => (
                <div key={approval.id} className="rounded border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{approval.entityType}</p>
                  <StatusBadge status={approval.status} />
                </div>
              ))}
              {report.exceptions.pendingApprovals.length === 0 ? <p className="text-slate-500">No pending approvals.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Unapproved Discounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {report.exceptions.unapprovedDiscounts.map((approval) => (
                <div key={approval.id} className="rounded border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{approval.entityType}</p>
                  <StatusBadge status={approval.status} />
                </div>
              ))}
              {report.exceptions.unapprovedDiscounts.length === 0 ? <p className="text-slate-500">No unapproved discounts.</p> : null}
            </CardContent>
          </Card>
        </section>
      </TabsContent>
    </Tabs>
  );
}
