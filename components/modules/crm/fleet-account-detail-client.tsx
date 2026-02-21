"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type FleetAccountDetail = {
  id: string;
  name: string;
  billingTerms: string | null;
  taxExempt: boolean;
  notes: string | null;
  locationsJson: unknown;
  memberships: Array<{
    id: string;
    customer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
    };
  }>;
  quotes: Array<{
    id: string;
    quoteNumber: string;
    status: string;
    total: string | number;
  }>;
};

export function FleetAccountDetailClient({ account }: { account: FleetAccountDetail }) {
  const [saving, setSaving] = useState(false);

  const updateAccount = async (formData: FormData) => {
    setSaving(true);
    const response = await fetch(`/api/fleet-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        billingTerms: String(formData.get("billingTerms") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        taxExempt: formData.get("taxExempt") === "on",
      }),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Unable to update fleet account");
      return;
    }
    toast.success("Fleet account updated");
    window.location.reload();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{account.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAccount} className="space-y-3">
            <Input name="billingTerms" defaultValue={account.billingTerms ?? ""} placeholder="Billing terms" />
            <Textarea name="notes" defaultValue={account.notes ?? ""} placeholder="Notes" />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="taxExempt" defaultChecked={account.taxExempt} />
              Tax exempt
            </label>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Linked Customers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {account.memberships.length === 0 ? <p className="text-sm text-slate-500">No linked customers.</p> : null}
            {account.memberships.map((membership) => (
              <div key={membership.id} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">
                  {membership.customer.firstName} {membership.customer.lastName}
                </p>
                <p className="text-xs text-slate-500">{membership.customer.email ?? "No email"}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fleet Quotes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {account.quotes.length === 0 ? <p className="text-sm text-slate-500">No quotes created.</p> : null}
            {account.quotes.map((quote) => (
              <div key={quote.id} className="flex items-center justify-between rounded border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{quote.quoteNumber}</p>
                  <p className="text-xs text-slate-500">{quote.status}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/quotes/${quote.id}`}>Open</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
