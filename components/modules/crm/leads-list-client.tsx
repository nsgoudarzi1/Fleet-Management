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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

type LeadRow = {
  id: string;
  source: string;
  stage: string;
  statusNote: string | null;
  nextAction: string | null;
  nextActionAt: string | Date | null;
  slaDueAt: string | Date | null;
  firstResponseAt: string | Date | null;
  createdAt: string | Date;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  vehicle: {
    id: string;
    stockNumber: string;
    year: number;
    make: string;
    model: string;
  } | null;
  assignedTo: { id: string; name: string | null } | null;
};

const LEAD_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "APPOINTMENT_SET", "NEGOTIATION", "WON", "LOST"];

function slaLabel(date: Date | string | null) {
  if (!date) return "No SLA";
  const dueAt = new Date(date).getTime();
  const diffHours = Math.round((dueAt - Date.now()) / 3_600_000);
  if (diffHours <= 0) return `${Math.abs(diffHours)}h overdue`;
  return `${diffHours}h left`;
}

export function LeadsListClient({ rows }: { rows: LeadRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStage, setBulkStage] = useState("CONTACTED");

  const columns = useMemo(
    () => [
      {
        key: "customer",
        label: "Customer",
        render: (row: LeadRow) =>
          row.customer ? `${row.customer.firstName} ${row.customer.lastName}` : "Unconverted lead",
      },
      {
        key: "source",
        label: "Source",
      },
      {
        key: "stage",
        label: "Stage",
        render: (row: LeadRow) => <StatusBadge status={row.stage} />,
      },
      {
        key: "nextAction",
        label: "Next Action",
        render: (row: LeadRow) => row.nextAction ?? "-",
      },
      {
        key: "sla",
        label: "SLA Timer",
        render: (row: LeadRow) => (
          <span className={row.firstResponseAt ? "text-emerald-700" : row.slaDueAt && new Date(row.slaDueAt).getTime() < Date.now() ? "text-red-600" : "text-slate-700"}>
            {row.firstResponseAt ? `Responded ${formatDate(row.firstResponseAt, "MMM d, h:mm a")}` : slaLabel(row.slaDueAt)}
          </span>
        ),
      },
      {
        key: "createdAt",
        label: "Created",
        render: (row: LeadRow) => formatDate(row.createdAt),
      },
    ],
    [],
  );

  return (
    <div>
      <SavedViewsBar entityKey="leads" />
      <DataTable
        rows={rows}
        columns={columns}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        storageKey="leads-table"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={bulkStage}
              onChange={(event) => setBulkStage(event.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selected.length === 0}
              onClick={async () => {
                await Promise.all(
                  selected.map((id) =>
                    fetch(`/api/leads/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ stage: bulkStage }),
                    }),
                  ),
                );
                toast.success(`Updated ${selected.length} leads`);
                window.location.reload();
              }}
            >
              Bulk Stage
            </Button>
            <CreateLeadDialog />
          </div>
        }
        rowActions={(row) => (
          <>
            <EntityDrawer
              title={`${row.source} Lead`}
              description={row.customer ? `${row.customer.firstName} ${row.customer.lastName}` : "Unconverted"}
              trigger={
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              }
            >
              <div className="space-y-2 text-sm">
                <p className="text-slate-500">Stage</p>
                <StatusBadge status={row.stage} />
                <p className="text-slate-500">Next Action</p>
                <p>{row.nextAction ?? "None"}</p>
                <Button asChild className="w-full">
                  <Link href={`/crm/leads/${row.id}`}>Open Lead</Link>
                </Button>
              </div>
            </EntityDrawer>
            <Button asChild variant="outline" size="sm">
              <Link href={`/crm/leads/${row.id}`}>Open</Link>
            </Button>
          </>
        )}
      />
    </div>
  );
}

function CreateLeadDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async (formData: FormData) => {
    setSaving(true);
    const payload = {
      source: String(formData.get("source") ?? ""),
      stage: String(formData.get("stage") ?? "NEW"),
      statusNote: String(formData.get("statusNote") ?? ""),
      nextAction: String(formData.get("nextAction") ?? ""),
      nextActionAt: formData.get("nextActionAt")
        ? new Date(String(formData.get("nextActionAt"))).toISOString()
        : undefined,
      slaDueAt: formData.get("slaDueAt") ? new Date(String(formData.get("slaDueAt"))).toISOString() : undefined,
    };
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Unable to create lead");
      return;
    }
    toast.success("Lead created");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
        </DialogHeader>
        <form action={create} className="grid gap-3 sm:grid-cols-2">
          <Input name="source" placeholder="Source (Cars.com, walk-in...)" required />
          <select name="stage" defaultValue="NEW" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="NEW">NEW</option>
            <option value="CONTACTED">CONTACTED</option>
            <option value="QUALIFIED">QUALIFIED</option>
            <option value="APPOINTMENT_SET">APPOINTMENT SET</option>
            <option value="NEGOTIATION">NEGOTIATION</option>
          </select>
          <Input name="nextAction" placeholder="Next Action" />
          <Input name="nextActionAt" type="datetime-local" />
          <Input name="slaDueAt" type="datetime-local" />
          <Textarea name="statusNote" placeholder="Notes" className="sm:col-span-2" />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
