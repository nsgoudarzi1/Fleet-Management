"use client";

import { Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const SOURCE_KEYS: Array<{ sourceType: "RO_CLOSE" | "DEAL_DELIVERY"; key: string; label: string }> = [
  { sourceType: "RO_CLOSE", key: "cash", label: "RO Cash" },
  { sourceType: "RO_CLOSE", key: "receivable", label: "RO A/R" },
  { sourceType: "RO_CLOSE", key: "laborRevenue", label: "RO Labor Revenue" },
  { sourceType: "RO_CLOSE", key: "partsRevenue", label: "RO Parts/Fee Revenue" },
  { sourceType: "RO_CLOSE", key: "taxPayable", label: "RO Tax Payable" },
  { sourceType: "DEAL_DELIVERY", key: "receivable", label: "Deal A/R" },
  { sourceType: "DEAL_DELIVERY", key: "salesRevenue", label: "Deal Sales Revenue" },
  { sourceType: "DEAL_DELIVERY", key: "taxPayable", label: "Deal Tax Payable" },
];

type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  isPostingAllowed: boolean;
};

type MappingRow = {
  id: string;
  sourceType: string;
  key: string;
  accountId: string;
  account: { id: string; code: string; name: string };
};

export function CoaManagerClient({
  accounts,
  mappings,
}: {
  accounts: AccountRow[];
  mappings: MappingRow[];
}) {
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of mappings) {
      initial[`${item.sourceType}:${item.key}`] = item.accountId;
    }
    return initial;
  });

  const columns = useMemo(
    () => [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
      { key: "isActive", label: "Active", render: (row: AccountRow) => (row.isActive ? "Yes" : "No") },
      {
        key: "isPostingAllowed",
        label: "Posting",
        render: (row: AccountRow) => (row.isPostingAllowed ? "Allowed" : "Blocked"),
      },
    ],
    [],
  );

  const saveMappings = async () => {
    const entries = Object.entries(mappingDraft);
    if (!entries.length) return;

    const responses = await Promise.all(
      entries.map(([compound, accountId]) => {
        const [sourceType, key] = compound.split(":");
        if (!sourceType || !key || !accountId) return Promise.resolve(null);
        return fetch("/api/accounting/posting-maps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType, key, accountId }),
        });
      }),
    );

    if (responses.some((response) => response && !response.ok)) {
      toast.error("Some posting mappings failed to save.");
      return;
    }

    toast.success("Posting mappings saved.");
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <DataTable
        rows={accounts}
        columns={columns}
        storageKey="coa-table"
        actions={
          <div className="flex items-center gap-2">
            <CreateAccountDialog />
          </div>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Posting Account Map</h2>
          <Button size="sm" onClick={() => void saveMappings()}>
            <Save className="mr-2 h-4 w-4" />
            Save Mappings
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOURCE_KEYS.map((keyDef) => {
            const compound = `${keyDef.sourceType}:${keyDef.key}`;
            return (
              <label key={compound} className="space-y-1 text-sm">
                <span>{keyDef.label}</span>
                <select
                  value={mappingDraft[compound] ?? ""}
                  onChange={(event) =>
                    setMappingDraft((current) => ({
                      ...current,
                      [compound]: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="">Unmapped</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} {account.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CreateAccountDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async (formData: FormData) => {
    setSaving(true);
    const payload = {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? "ASSET"),
      description: String(formData.get("description") ?? "") || undefined,
      isPostingAllowed: formData.get("isPostingAllowed") === "on",
    };

    const response = await fetch("/api/accounting/coa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!response.ok) {
      toast.error("Unable to create account.");
      return;
    }

    toast.success("Account created.");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Chart of Account</DialogTitle>
        </DialogHeader>
        <form action={create} className="grid gap-2">
          <Input name="code" placeholder="Code (e.g. 1000)" required />
          <Input name="name" placeholder="Account name" required />
          <select name="type" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="ASSET">ASSET</option>
            <option value="LIABILITY">LIABILITY</option>
            <option value="EQUITY">EQUITY</option>
            <option value="REVENUE">REVENUE</option>
            <option value="EXPENSE">EXPENSE</option>
            <option value="COGS">COGS</option>
          </select>
          <Input name="description" placeholder="Description" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPostingAllowed" defaultChecked />Posting allowed</label>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
