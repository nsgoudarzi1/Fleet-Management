"use client";

import { Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

type TemplateRow = {
  id: string;
  orgId: string | null;
  name: string;
  docType: DocumentType;
  jurisdiction: string;
  dealType: DealType;
  version: number;
  templateEngine: DocumentTemplateEngine;
  effectiveFrom: string | Date;
  effectiveTo: string | Date | null;
  defaultForOrg: boolean;
  isDefault: boolean;
};

type DealType = "CASH" | "FINANCE" | "LEASE";
type DocumentType =
  | "BUYERS_ORDER"
  | "RETAIL_INSTALLMENT_CONTRACT"
  | "ODOMETER_DISCLOSURE"
  | "POWER_OF_ATTORNEY"
  | "TITLE_REG_APPLICATION"
  | "WE_OWE"
  | "PRIVACY_NOTICE";
type DocumentTemplateEngine = "HTML" | "DOCX";

const DOC_TYPES: DocumentType[] = [
  "BUYERS_ORDER",
  "RETAIL_INSTALLMENT_CONTRACT",
  "ODOMETER_DISCLOSURE",
  "POWER_OF_ATTORNEY",
  "TITLE_REG_APPLICATION",
  "WE_OWE",
  "PRIVACY_NOTICE",
];
const DEAL_TYPES: DealType[] = ["CASH", "FINANCE", "LEASE"];
const ENGINES: DocumentTemplateEngine[] = ["HTML", "DOCX"];

const SAMPLE_SNAPSHOT = `{
  "dealId": "sample-deal",
  "jurisdiction": "TX",
  "dealType": "FINANCE",
  "salePrice": 24000,
  "downPayment": 3000,
  "taxes": 1400,
  "fees": 500,
  "financedAmount": 22900,
  "apr": 6.5,
  "termMonths": 72,
  "hasTradeIn": true,
  "customer": { "firstName": "Jordan", "lastName": "Miles", "email": "jordan@example.com" },
  "vehicle": { "year": 2022, "make": "Toyota", "model": "Camry", "vin": "4T1X11AK4NU123456", "mileage": 24000, "stockNumber": "STK-88" },
  "dealer": { "name": "Summit Auto Group", "taxRate": 0.075, "docFee": 499, "licenseFee": 199 }
}`;

export function TemplatesManagerClient() {
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewDealId, setPreviewDealId] = useState("");
  const [previewSnapshot, setPreviewSnapshot] = useState(SAMPLE_SNAPSHOT);
  const [filters, setFilters] = useState({
    jurisdiction: "",
    docType: "",
    dealType: "",
  });
  const [form, setForm] = useState({
    name: "",
    docType: "BUYERS_ORDER" as DocumentType,
    jurisdiction: "TX",
    dealType: "FINANCE" as DealType,
    templateEngine: "HTML" as DocumentTemplateEngine,
    sourceHtml: "<h1>New Template</h1><p>{{customer.fullName}}</p><p>{{{SIGN_BUYER_1}}}</p>",
    sourceDocxBase64: "",
    sourceDocxFileName: "",
    requiredFieldsJson: '{"requiredPaths":["customer.fullName","vehicle.vin","deal.dealNumber"]}',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    defaultForOrg: true,
  });

  const filteredItems = useMemo(() => items, [items]);

  const loadTemplates = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.jurisdiction) params.set("jurisdiction", filters.jurisdiction);
    if (filters.docType) params.set("docType", filters.docType);
    if (filters.dealType) params.set("dealType", filters.dealType);
    const response = await fetch(`/api/compliance/templates?${params.toString()}`);
    setLoading(false);
    if (!response.ok) {
      toast.error("Unable to load templates.");
      return;
    }
    const payload = (await response.json()) as {
      data: { items: TemplateRow[]; canonicalVariables: string[] };
    };
    setItems(payload.data.items);
    setVariables(payload.data.canonicalVariables);
  };

  useEffect(() => {
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDocxFileChange = async (file: File | null) => {
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    const base64 = window.btoa(binary);
    setForm((current) => ({
      ...current,
      sourceDocxBase64: base64,
      sourceDocxFileName: file.name,
    }));
  };

  const createTemplate = async () => {
    let requiredFieldsJson: unknown;
    try {
      requiredFieldsJson = JSON.parse(form.requiredFieldsJson);
    } catch {
      toast.error("requiredFields JSON is invalid.");
      return;
    }

    const response = await fetch("/api/compliance/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        docType: form.docType,
        jurisdiction: form.jurisdiction,
        dealType: form.dealType,
        templateEngine: form.templateEngine,
        sourceHtml: form.templateEngine === "HTML" ? form.sourceHtml : undefined,
        sourceDocxBase64: form.templateEngine === "DOCX" ? form.sourceDocxBase64 : undefined,
        sourceDocxFileName: form.templateEngine === "DOCX" ? form.sourceDocxFileName : undefined,
        requiredFieldsJson,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
        defaultForOrg: form.defaultForOrg,
      }),
    });
    if (!response.ok) {
      toast.error("Unable to create template.");
      return;
    }
    toast.success("Template created.");
    setCreateOpen(false);
    await loadTemplates();
  };

  const deleteTemplate = async (templateId: string) => {
    if (!window.confirm("Soft-delete this template version?")) return;
    const response = await fetch(`/api/compliance/templates/${templateId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Unable to delete template.");
      return;
    }
    toast.success("Template deleted.");
    await loadTemplates();
  };

  const setDefaultTemplate = async (templateId: string) => {
    const response = await fetch(`/api/compliance/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultForOrg: true }),
    });
    if (!response.ok) {
      toast.error("Unable to mark as default.");
      return;
    }
    toast.success("Default template updated.");
    await loadTemplates();
  };

  const previewTemplate = async (templateId: string) => {
    let sampleSnapshot: unknown;
    if (!previewDealId.trim()) {
      try {
        sampleSnapshot = JSON.parse(previewSnapshot);
      } catch {
        toast.error("Sample snapshot JSON is invalid.");
        return;
      }
    }
    const response = await fetch(`/api/compliance/templates/${templateId}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId: previewDealId.trim() || undefined,
        sampleSnapshot,
      }),
    });
    if (!response.ok) {
      toast.error("Unable to generate preview.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Template Manager</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void loadTemplates()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New template</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Not legal advice. Only publish templates after legal review.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input placeholder="Template name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                    <select className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.templateEngine} onChange={(event) => setForm((current) => ({ ...current, templateEngine: event.target.value as DocumentTemplateEngine }))}>
                      {ENGINES.map((engine) => (
                        <option key={engine} value={engine}>{engine}</option>
                      ))}
                    </select>
                    <select className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.docType} onChange={(event) => setForm((current) => ({ ...current, docType: event.target.value as DocumentType }))}>
                      {DOC_TYPES.map((docType) => (
                        <option key={docType} value={docType}>{docType}</option>
                      ))}
                    </select>
                    <Input placeholder="State (TX)" value={form.jurisdiction} onChange={(event) => setForm((current) => ({ ...current, jurisdiction: event.target.value.toUpperCase() }))} />
                    <select className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.dealType} onChange={(event) => setForm((current) => ({ ...current, dealType: event.target.value as DealType }))}>
                      {DEAL_TYPES.map((dealType) => (
                        <option key={dealType} value={dealType}>{dealType}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.defaultForOrg} onChange={(event) => setForm((current) => ({ ...current, defaultForOrg: event.target.checked }))} />
                      Default for this org scope
                    </label>
                    <Input type="date" value={form.effectiveFrom} onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))} />
                    <Input type="date" value={form.effectiveTo} onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))} />
                  </div>

                  {form.templateEngine === "HTML" ? (
                    <Textarea rows={12} value={form.sourceHtml} onChange={(event) => setForm((current) => ({ ...current, sourceHtml: event.target.value }))} />
                  ) : (
                    <Input type="file" accept=".docx" onChange={(event) => void onDocxFileChange(event.target.files?.[0] ?? null)} />
                  )}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">requiredFields schema JSON</p>
                    <Textarea rows={4} value={form.requiredFieldsJson} onChange={(event) => setForm((current) => ({ ...current, requiredFieldsJson: event.target.value }))} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button onClick={() => void createTemplate()}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="Jurisdiction (TX)"
              value={filters.jurisdiction}
              onChange={(event) => setFilters((current) => ({ ...current, jurisdiction: event.target.value.toUpperCase() }))}
            />
            <select className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" value={filters.docType} onChange={(event) => setFilters((current) => ({ ...current, docType: event.target.value }))}>
              <option value="">All doc types</option>
              {DOC_TYPES.map((docType) => (
                <option key={docType} value={docType}>{docType}</option>
              ))}
            </select>
            <select className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" value={filters.dealType} onChange={(event) => setFilters((current) => ({ ...current, dealType: event.target.value }))}>
              <option value="">All deal types</option>
              {DEAL_TYPES.map((dealType) => (
                <option key={dealType} value={dealType}>{dealType}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => void loadTemplates()}>Apply</Button>
          </div>
          <div className="space-y-2">
            {filteredItems.map((template) => (
              <div key={template.id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{template.name}</p>
                    <p className="text-xs text-slate-500">
                      {template.jurisdiction} • {template.docType} • {template.dealType} • v{template.version}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {template.defaultForOrg || template.isDefault ? <Badge variant="success">Default</Badge> : null}
                    <Badge variant={template.orgId ? "outline" : "secondary"}>{template.orgId ? "Org" : "Global"}</Badge>
                    <Badge variant="outline">{template.templateEngine}</Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Effective {formatDate(template.effectiveFrom, "MMM d, yyyy")} - {template.effectiveTo ? formatDate(template.effectiveTo, "MMM d, yyyy") : "Open"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void previewTemplate(template.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void setDefaultTemplate(template.id)}>
                    Set default
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void deleteTemplate(template.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 ? <p className="text-sm text-slate-500">No templates found.</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview Input + Variable Inspector</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-2">
          <div className="space-y-2">
            <Input placeholder="Optional dealId for preview" value={previewDealId} onChange={(event) => setPreviewDealId(event.target.value)} />
            <Textarea rows={14} value={previewSnapshot} onChange={(event) => setPreviewSnapshot(event.target.value)} />
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="mb-2 text-sm font-medium text-slate-900">Canonical Variables</p>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <Badge key={variable} variant="outline">{variable}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
