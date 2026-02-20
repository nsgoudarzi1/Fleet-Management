"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";

type FundingRow = {
  id: string;
  status: string;
  lenderName: string;
  amountFinanced: number | string;
  nextAction: string | null;
  nextActionAt: string | Date | null;
  blockers: number;
  agingDays: number;
  blockerTypes: string[];
  deal: {
    id: string;
    dealNumber: string;
    customer: { firstName: string; lastName: string };
  };
};

const NEXT_STATUSES = ["SUBMITTED", "STIPS_REQUESTED", "APPROVED", "FUNDED", "PAID_OUT", "CLOSED"] as const;

export function FundingQueueClient({ initialItems }: { initialItems: FundingRow[] }) {
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const items = useMemo(
    () =>
      query.trim()
        ? initialItems.filter((item) =>
            `${item.deal.dealNumber} ${item.deal.customer.firstName} ${item.deal.customer.lastName} ${item.lenderName}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
        : initialItems,
    [initialItems, query],
  );

  const transition = async (fundingCaseId: string, status: string) => {
    setSavingId(fundingCaseId);
    const response = await fetch("/api/funding-cases/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundingCaseId, status }),
    });
    setSavingId(null);
    if (!response.ok) {
      toast.error("Unable to update funding status.");
      return;
    }
    toast.success("Funding status updated.");
    window.location.reload();
  };

  return (
    <div className="space-y-3">
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search deal, customer, lender" />
      <div className="grid gap-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                <Link href={`/deals/${item.deal.id}`} className="hover:underline">
                  {item.deal.dealNumber} • {item.deal.customer.firstName} {item.deal.customer.lastName}
                </Link>
              </CardTitle>
              <StatusBadge status={item.status} />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Lender: {item.lenderName} • Amount: {formatCurrency(item.amountFinanced)}</p>
              <p>Blockers: {item.blockers} • Aging: {item.agingDays}d</p>
              <p>Next Action: {item.nextAction ?? "None"} {item.nextActionAt ? `(${formatDate(item.nextActionAt, "MMM d, h:mm a")})` : ""}</p>
              {item.blockerTypes.length ? (
                <p className="text-xs text-amber-700">Missing: {item.blockerTypes.join(", ")}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {NEXT_STATUSES.map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === item.status ? "default" : "outline"}
                    disabled={savingId === item.id}
                    onClick={() => void transition(item.id, status)}
                  >
                    {status.replaceAll("_", " ")}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 ? <p className="text-sm text-slate-500">No funding cases in queue.</p> : null}
      </div>
    </div>
  );
}

