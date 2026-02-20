"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

type ImportJob = {
  id: string;
  entityType: string;
  status: string;
  createdAt: string | Date;
  rolledBackAt: string | Date | null;
  statsJson: { created?: number; updated?: number; skipped?: number; errors?: Array<{ row: number; message: string }> } | null;
  createdBy: { name: string | null; email: string } | null;
};

const ENTITY_FIELDS: Record<string, string[]> = {
  VEHICLE: ["stockNumber", "vin", "year", "make", "model", "trim", "mileage", "listPrice", "minPrice", "location"],
  CUSTOMER: ["firstName", "lastName", "email", "phone", "city", "state", "postalCode"],
  PART: ["partNumber", "description", "binLocation", "onHandQty", "reorderPoint", "unitCost", "unitPrice"],
  CHART_OF_ACCOUNT: ["code", "name", "type"],
};

export function ImportManagerClient({ initialJobs }: { initialJobs: ImportJob[] }) {
  const [entityType, setEntityType] = useState<keyof typeof ENTITY_FIELDS>("VEHICLE");
  const [fileName, setFileName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, string>>>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const fields = useMemo(() => ENTITY_FIELDS[entityType], [entityType]);

  const onFileChange = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvContent(text);
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) {
      toast.error(`CSV parse failed: ${parsed.errors[0]?.message ?? "unknown error"}`);
      return;
    }
    const first = parsed.data[0] ?? {};
    setColumns(Object.keys(first));
    setPreviewRows(parsed.data.slice(0, 5));
  };

  const runImport = async () => {
    if (!csvContent || !fileName) {
      toast.error("Upload a CSV file first.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/import/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, fileName, csvContent, mapping }),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Import failed.");
      return;
    }
    toast.success("Import job completed.");
    window.location.reload();
  };

  const rollback = async (importJobId: string) => {
    setRollingBackId(importJobId);
    const response = await fetch("/api/import/jobs/rollback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importJobId }),
    });
    setRollingBackId(null);
    if (!response.ok) {
      toast.error("Rollback failed.");
      return;
    }
    toast.success("Import rolled back.");
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Run CSV Import</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <select className="h-9 rounded border border-slate-300 px-2 text-sm" value={entityType} onChange={(event) => setEntityType(event.target.value as keyof typeof ENTITY_FIELDS)}>
              {Object.keys(ENTITY_FIELDS).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <Input type="file" accept=".csv,text/csv" onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)} />
            <Button onClick={() => void runImport()} disabled={saving}>{saving ? "Importing..." : "Run Import"}</Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {fields.map((field) => (
              <label key={field} className="flex items-center gap-2 text-sm">
                <span className="w-40">{field}</span>
                <select
                  className="h-8 flex-1 rounded border border-slate-300 px-2"
                  value={mapping[field] ?? ""}
                  onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}
                >
                  <option value="">Unmapped</option>
                  {columns.map((column) => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {previewRows.length ? <pre className="overflow-auto rounded bg-slate-100 p-2 text-xs">{JSON.stringify(previewRows, null, 2)}</pre> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Import Jobs</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {initialJobs.map((job) => (
            <div key={job.id} className="rounded border border-slate-200 p-3">
              <p className="font-medium text-slate-900">{job.entityType} • {job.status}</p>
              <p className="text-xs text-slate-500">
                {job.createdBy?.name ?? job.createdBy?.email ?? "System"} • {formatDate(job.createdAt, "MMM d, h:mm a")}
              </p>
              <p className="text-xs text-slate-500">
                Created {job.statsJson?.created ?? 0}, Updated {job.statsJson?.updated ?? 0}, Skipped {job.statsJson?.skipped ?? 0}
              </p>
              {job.status !== "ROLLED_BACK" ? (
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="outline" disabled={rollingBackId === job.id} onClick={() => void rollback(job.id)}>
                    {rollingBackId === job.id ? "Rolling back..." : "Rollback"}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          {initialJobs.length === 0 ? <p className="text-slate-500">No import jobs yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

