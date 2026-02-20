"use client";

import { AlertTriangle, Download, FileCheck2, FileWarning, RefreshCw, Send, Signature } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { InlineEditField } from "@/components/shared/inline-edit-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";

type DealDocumentRow = {
  id: string;
  docType: string;
  status: string;
  generatedAt: string | Date | null;
  fileKey: string | null;
  template: {
    id: string;
    name: string;
    version: number;
  } | null;
};

type DocumentsWorkspace = {
  checklist: Array<{
    docType: string;
    required: boolean;
    reason: string;
    templateAvailable: boolean;
    templateName: string | null;
    templateVersion: number | null;
    latestDocumentId: string | null;
    latestStatus: string | null;
  }>;
  validationErrors: Array<{
    code: string;
    message: string;
    severity: "error" | "warning";
    field?: string;
  }>;
  notices: string[];
  computedFields: Record<string, string | number | boolean | null>;
  documents: DealDocumentRow[];
  envelopes: Array<{
    id: string;
    provider: string;
    status: string;
    sentAt: string | Date | null;
    completedAt: string | Date | null;
    metadataJson: Record<string, unknown> | null;
  }>;
};

type DealDetail = {
  id: string;
  dealNumber: string;
  stage: string;
  fundingStatus: string;
  salePrice: string | number;
  downPayment: string | number;
  apr: string | number;
  termMonths: number;
  taxes: string | number;
  fees: string | number;
  financedAmount: string | number;
  monthlyPayment: string | number;
  checklist: {
    insurance?: boolean;
    odometer?: boolean;
    idVerification?: boolean;
    stips?: boolean;
  } | null;
  customer: { firstName: string; lastName: string; id: string; email?: string | null };
  vehicle: { year: number; make: string; model: string; stockNumber: string; id: string };
  lineItems: Array<{ id: string; label: string; amount: string | number; type: string }>;
  tradeIns: Array<{
    id: string;
    year: number | null;
    make: string | null;
    model: string | null;
    vin: string | null;
    mileage: number | null;
    allowance: string | number;
    payoff: string | number;
  }>;
  payments: Array<{ id: string; amount: string | number; method: string; postedAt: string | Date }>;
  fundingEvents: Array<{ id: string; status: string; amount: string | number; note: string | null; eventAt: string | Date }>;
  fundingCase?: {
    id: string;
    status: string;
    lenderName: string;
    amountFinanced: string | number;
    reserveAmount: string | number;
    feeTotal: string | number;
    nextAction: string | null;
    nextActionAt: string | Date | null;
    stips: Array<{
      id: string;
      docType: string;
      required: boolean;
      receivedAt: string | Date | null;
      verifiedAt: string | Date | null;
      notes: string | null;
    }>;
  } | null;
  activities: Array<{ id: string; message: string; createdAt: string | Date; type: string }>;
};

const DEAL_STAGES = ["DRAFT", "SUBMITTED", "APPROVED", "CONTRACTED", "DELIVERED"];
const FUNDING_STATUSES = ["PENDING", "IN_REVIEW", "FUNDED", "HOLD", "FAILED"];
const FUNDING_CASE_STATUSES = ["NOT_SUBMITTED", "SUBMITTED", "STIPS_REQUESTED", "APPROVED", "FUNDED", "PAID_OUT", "CLOSED"];

export function DealDetailClient({
  deal,
  documentsWorkspace,
}: {
  deal: DealDetail;
  documentsWorkspace: DocumentsWorkspace;
}) {
  const [updatingStage, setUpdatingStage] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [savingTrade, setSavingTrade] = useState(false);
  const [savingFunding, setSavingFunding] = useState(false);
  const [savingFundingCase, setSavingFundingCase] = useState(false);
  const [savingStip, setSavingStip] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [sendingEsign, setSendingEsign] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [buyerSignerName, setBuyerSignerName] = useState(`${deal.customer.firstName} ${deal.customer.lastName}`.trim());
  const [buyerSignerEmail, setBuyerSignerEmail] = useState(deal.customer.email ?? "");
  const [dealerSignerName, setDealerSignerName] = useState("Dealer Representative");
  const [dealerSignerEmail, setDealerSignerEmail] = useState("");
  const [voidingEnvelopeId, setVoidingEnvelopeId] = useState<string | null>(null);
  const [completingEnvelopeId, setCompletingEnvelopeId] = useState<string | null>(null);

  const updateStage = async (stage: string) => {
    setUpdatingStage(true);
    const response = await fetch("/api/deals/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId: deal.id,
        stage,
      }),
    });
    setUpdatingStage(false);
    if (!response.ok) {
      toast.error("Unable to update stage");
      return;
    }
    toast.success("Deal stage updated");
    window.location.reload();
  };

  const updateChecklist = async (formData: FormData) => {
    setSavingChecklist(true);
    const payload = {
      dealId: deal.id,
      insurance: formData.get("insurance") === "on",
      odometer: formData.get("odometer") === "on",
      idVerification: formData.get("idVerification") === "on",
      stips: formData.get("stips") === "on",
    };
    const response = await fetch("/api/deals/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingChecklist(false);
    if (!response.ok) {
      toast.error("Unable to update checklist");
      return;
    }
    toast.success("Checklist saved");
    window.location.reload();
  };

  const upsertTrade = async (formData: FormData) => {
    setSavingTrade(true);
    const payload = {
      dealId: deal.id,
      vin: String(formData.get("vin") ?? ""),
      year: Number(formData.get("year") ?? 0),
      make: String(formData.get("make") ?? ""),
      model: String(formData.get("model") ?? ""),
      mileage: Number(formData.get("mileage") ?? 0),
      allowance: Number(formData.get("allowance") ?? 0),
      payoff: Number(formData.get("payoff") ?? 0),
      actualCashValue: Number(formData.get("actualCashValue") ?? 0),
    };
    const response = await fetch("/api/deals/trade-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingTrade(false);
    if (!response.ok) {
      toast.error("Unable to save trade-in");
      return;
    }
    toast.success("Trade-in saved");
    window.location.reload();
  };

  const addFundingEvent = async (formData: FormData) => {
    setSavingFunding(true);
    const payload = {
      dealId: deal.id,
      status: String(formData.get("status") ?? "IN_REVIEW"),
      amount: Number(formData.get("amount") ?? 0),
      note: String(formData.get("note") ?? ""),
    };
    const response = await fetch("/api/funding-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingFunding(false);
    if (!response.ok) {
      toast.error("Unable to add funding event");
      return;
    }
    toast.success("Funding event added");
    window.location.reload();
  };

  const createFundingCase = async (formData: FormData) => {
    setSavingFundingCase(true);
    const response = await fetch("/api/funding-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId: deal.id,
        lenderName: String(formData.get("lenderName") ?? ""),
        lenderContactName: String(formData.get("lenderContactName") ?? ""),
        lenderContactEmail: String(formData.get("lenderContactEmail") ?? ""),
        amountFinanced: Number(formData.get("amountFinanced") ?? deal.financedAmount ?? 0),
        reserveAmount: Number(formData.get("reserveAmount") ?? 0),
        feeTotal: Number(formData.get("feeTotal") ?? 0),
        nextAction: String(formData.get("nextAction") ?? ""),
      }),
    });
    setSavingFundingCase(false);
    if (!response.ok) {
      toast.error("Unable to create funding case.");
      return;
    }
    toast.success("Funding case created.");
    window.location.reload();
  };

  const transitionFundingCase = async (status: string) => {
    if (!deal.fundingCase?.id) return;
    setSavingFundingCase(true);
    const response = await fetch("/api/funding-cases/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundingCaseId: deal.fundingCase.id, status }),
    });
    setSavingFundingCase(false);
    if (!response.ok) {
      toast.error("Unable to update funding case status.");
      return;
    }
    toast.success("Funding case status updated.");
    window.location.reload();
  };

  const addFundingStip = async (formData: FormData) => {
    if (!deal.fundingCase?.id) return;
    setSavingStip(true);
    const response = await fetch("/api/funding-stips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fundingCaseId: deal.fundingCase.id,
        docType: String(formData.get("docType") ?? ""),
        required: formData.get("required") === "on",
        received: formData.get("received") === "on",
        verified: formData.get("verified") === "on",
        notes: String(formData.get("notes") ?? ""),
      }),
    });
    setSavingStip(false);
    if (!response.ok) {
      toast.error("Unable to save stip.");
      return;
    }
    toast.success("Stip saved.");
    window.location.reload();
  };

  const generateAllDocuments = async (regenerate: boolean) => {
    setGeneratingDocs(true);
    const regenerateReason =
      regenerate
        ? window.prompt("Regenerate reason is required for audit logging:")
        : undefined;
    if (regenerate && !regenerateReason) {
      setGeneratingDocs(false);
      toast.error("Regenerate reason is required.");
      return;
    }

    const response = await fetch(`/api/deals/${deal.id}/documents/generate-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        regenerate,
        regenerateReason,
      }),
    });
    setGeneratingDocs(false);
    if (!response.ok) {
      toast.error("Unable to generate required documents.");
      return;
    }
    toast.success("Document generation completed.");
    window.location.reload();
  };

  const openSendEsignDialog = () => {
    const generatedIds = documentsWorkspace.documents
      .filter((document) => document.status === "GENERATED" && !!document.fileKey)
      .map((document) => document.id);
    setSelectedDocIds(generatedIds);
    setSendDialogOpen(true);
  };

  const sendForEsign = async () => {
    if (!selectedDocIds.length) {
      toast.error("Select at least one generated document.");
      return;
    }
    if (!buyerSignerName.trim() || !buyerSignerEmail.trim()) {
      toast.error("Buyer signer name and email are required.");
      return;
    }

    setSendingEsign(true);
    const recipients = [
      { role: "buyer", name: buyerSignerName.trim(), email: buyerSignerEmail.trim(), order: 1 },
      ...(dealerSignerEmail.trim()
        ? [{ role: "dealer", name: dealerSignerName.trim() || "Dealer", email: dealerSignerEmail.trim(), order: 2 }]
        : []),
    ];
    const requestId = `${deal.id}-${Date.now()}`;
    const response = await fetch(`/api/deals/${deal.id}/documents/send-for-esign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentIds: selectedDocIds,
        recipients,
        requestId,
      }),
    });
    setSendingEsign(false);
    if (!response.ok) {
      toast.error("Unable to send envelope for e-sign.");
      return;
    }
    toast.success("Envelope sent for e-sign.");
    setSendDialogOpen(false);
    window.location.reload();
  };

  const voidEnvelope = async (envelopeId: string) => {
    const reason = window.prompt("Void reason is required:");
    if (!reason) {
      toast.error("Void reason is required.");
      return;
    }
    setVoidingEnvelopeId(envelopeId);
    const response = await fetch(`/api/deals/${deal.id}/documents/envelopes/${envelopeId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setVoidingEnvelopeId(null);
    if (!response.ok) {
      toast.error("Unable to void envelope.");
      return;
    }
    toast.success("Envelope voided.");
    window.location.reload();
  };

  const completeStubEnvelope = async (envelopeId: string) => {
    setCompletingEnvelopeId(envelopeId);
    const response = await fetch(`/api/deals/${deal.id}/documents/envelopes/${envelopeId}/complete-stub`, {
      method: "POST",
    });
    setCompletingEnvelopeId(null);
    if (!response.ok) {
      toast.error("Unable to complete stub signing.");
      return;
    }
    toast.success("Stub signing completed.");
    window.location.reload();
  };

  const checklistByDocType = useMemo(
    () => new Map(documentsWorkspace.checklist.map((item) => [item.docType, item])),
    [documentsWorkspace.checklist],
  );

  const checklistErrors = documentsWorkspace.validationErrors.filter((item) => item.severity === "error");
  const checklistWarnings = documentsWorkspace.validationErrors.filter((item) => item.severity === "warning");

  const checklist = deal.checklist ?? {};
  const trade = deal.tradeIns[0];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <p className="text-xs text-slate-500">{deal.dealNumber}</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {deal.customer.firstName} {deal.customer.lastName} • {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={deal.stage} />
          <StatusBadge status={deal.fundingStatus} />
          <p className="text-sm text-slate-500">{deal.vehicle.stockNumber}</p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <Tabs defaultValue="numbers">
            <TabsList>
              <TabsTrigger value="numbers">Deal Numbers</TabsTrigger>
              <TabsTrigger value="trade">Trade-In</TabsTrigger>
              <TabsTrigger value="funding">Funding</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            <TabsContent value="numbers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inline Desking</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <InlineEditField label="Sale Price" value={deal.salePrice} field="salePrice" type="number" endpoint={`/api/deals/${deal.id}`} />
                  <InlineEditField label="Down Payment" value={deal.downPayment} field="downPayment" type="number" endpoint={`/api/deals/${deal.id}`} />
                  <InlineEditField label="APR" value={deal.apr} field="apr" type="number" endpoint={`/api/deals/${deal.id}`} />
                  <InlineEditField label="Term Months" value={deal.termMonths} field="termMonths" type="number" endpoint={`/api/deals/${deal.id}`} />
                  <InlineEditField label="Taxes" value={deal.taxes} field="taxes" type="number" endpoint={`/api/deals/${deal.id}`} />
                  <InlineEditField label="Fees" value={deal.fees} field="fees" type="number" endpoint={`/api/deals/${deal.id}`} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Payment Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  <p className="text-sm text-slate-500">Financed Amount</p>
                  <p className="text-sm text-right font-semibold">{formatCurrency(deal.financedAmount)}</p>
                  <p className="text-sm text-slate-500">Monthly Payment</p>
                  <p className="text-sm text-right font-semibold">{formatCurrency(deal.monthlyPayment)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Document Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={updateChecklist} className="space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox name="insurance" defaultChecked={!!checklist.insurance} />
                      Insurance verified
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox name="odometer" defaultChecked={!!checklist.odometer} />
                      Odometer statement
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox name="idVerification" defaultChecked={!!checklist.idVerification} />
                      ID verification
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox name="stips" defaultChecked={!!checklist.stips} />
                      Stips completed
                    </label>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={savingChecklist}>
                        {savingChecklist ? "Saving..." : "Save Checklist"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="trade">
              <Card>
                <CardHeader>
                  <CardTitle>Trade-In Capture</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={upsertTrade} className="grid gap-2 sm:grid-cols-2">
                    <Input name="vin" placeholder="VIN" defaultValue={trade?.vin ?? ""} />
                    <Input name="year" type="number" placeholder="Year" defaultValue={trade?.year ?? ""} />
                    <Input name="make" placeholder="Make" defaultValue={trade?.make ?? ""} />
                    <Input name="model" placeholder="Model" defaultValue={trade?.model ?? ""} />
                    <Input name="mileage" type="number" placeholder="Mileage" defaultValue={trade?.mileage ?? ""} />
                    <Input name="allowance" type="number" placeholder="Allowance" defaultValue={trade ? Number(trade.allowance) : 0} />
                    <Input name="payoff" type="number" placeholder="Payoff" defaultValue={trade ? Number(trade.payoff) : 0} />
                    <Input name="actualCashValue" type="number" placeholder="ACV" defaultValue={trade ? Number(trade.allowance) : 0} />
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit" disabled={savingTrade}>
                        {savingTrade ? "Saving..." : "Save Trade-In"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="funding">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Funding Case</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {deal.fundingCase ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">{deal.fundingCase.lenderName}</p>
                            <p className="text-xs text-slate-500">
                              Amount {formatCurrency(deal.fundingCase.amountFinanced)} • Reserve {formatCurrency(deal.fundingCase.reserveAmount)}
                            </p>
                          </div>
                          <StatusBadge status={deal.fundingCase.status} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {FUNDING_CASE_STATUSES.map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              variant={status === deal.fundingCase?.status ? "default" : "outline"}
                              disabled={savingFundingCase}
                              onClick={() => void transitionFundingCase(status)}
                            >
                              {status.replaceAll("_", " ")}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-slate-600">
                          Next action: {deal.fundingCase.nextAction ?? "None"} {deal.fundingCase.nextActionAt ? `(${formatDate(deal.fundingCase.nextActionAt, "MMM d, h:mm a")})` : ""}
                        </p>
                      </>
                    ) : (
                      <form action={createFundingCase} className="grid gap-2 sm:grid-cols-2">
                        <Input name="lenderName" placeholder="Lender name" required />
                        <Input name="lenderContactName" placeholder="Lender contact" />
                        <Input name="lenderContactEmail" placeholder="Lender email" />
                        <Input name="amountFinanced" type="number" defaultValue={Number(deal.financedAmount)} placeholder="Amount financed" />
                        <Input name="reserveAmount" type="number" defaultValue={0} placeholder="Reserve" />
                        <Input name="feeTotal" type="number" defaultValue={0} placeholder="Fees total" />
                        <Textarea name="nextAction" placeholder="Next action" className="sm:col-span-2" />
                        <div className="sm:col-span-2 flex justify-end">
                          <Button type="submit" disabled={savingFundingCase}>
                            {savingFundingCase ? "Saving..." : "Create Funding Case"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </CardContent>
                </Card>

                {deal.fundingCase ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Stipulations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <form action={addFundingStip} className="grid gap-2 sm:grid-cols-2">
                        <Input name="docType" placeholder="Doc type (e.g. PROOF_OF_INCOME)" required />
                        <label className="flex items-center gap-2 text-sm"><Checkbox name="required" defaultChecked />Required</label>
                        <label className="flex items-center gap-2 text-sm"><Checkbox name="received" />Received</label>
                        <label className="flex items-center gap-2 text-sm"><Checkbox name="verified" />Verified</label>
                        <Textarea name="notes" className="sm:col-span-2" placeholder="Notes" />
                        <div className="sm:col-span-2 flex justify-end">
                          <Button type="submit" disabled={savingStip}>{savingStip ? "Saving..." : "Add Stip"}</Button>
                        </div>
                      </form>
                      {deal.fundingCase.stips.map((stip) => (
                        <div key={stip.id} className="rounded border border-slate-200 p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-slate-900">{stip.docType}</p>
                            <p className="text-xs text-slate-500">
                              {stip.receivedAt ? "Received" : "Missing"} • {stip.verifiedAt ? "Verified" : "Unverified"}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500">{stip.notes ?? "No notes"}</p>
                        </div>
                      ))}
                      {deal.fundingCase.stips.length === 0 ? <p className="text-sm text-slate-500">No stips added yet.</p> : null}
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle>Funding Events</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <form action={addFundingEvent} className="grid gap-2 sm:grid-cols-2">
                      <select name="status" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue="IN_REVIEW">
                        {FUNDING_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <Input name="amount" type="number" placeholder="Amount" defaultValue={Number(deal.financedAmount)} />
                      <Textarea name="note" placeholder="Funding note" className="sm:col-span-2" />
                      <div className="sm:col-span-2 flex justify-end">
                        <Button type="submit" disabled={savingFunding}>
                          {savingFunding ? "Saving..." : "Add Event"}
                        </Button>
                      </div>
                    </form>
                    {deal.fundingEvents.map((event) => (
                      <div key={event.id} className="rounded border border-slate-200 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <StatusBadge status={event.status} />
                          <p className="font-semibold">{formatCurrency(event.amount)}</p>
                        </div>
                        <p className="text-xs text-slate-500">{event.note ?? "No note"} • {formatDate(event.eventAt, "MMM d, h:mm a")}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Required Compliance Checklist</CardTitle>
                    <p className="text-xs text-slate-500">Jurisdiction and scenario-driven. Not legal advice.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" onClick={openSendEsignDialog}>
                          <Send className="mr-2 h-4 w-4" />
                          Send for e-sign
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-xl">
                        <DialogHeader>
                          <DialogTitle>Send for e-sign</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <p className="text-xs text-amber-700">
                            Not legal advice. Verify signer order, disclosures, and state requirements with counsel.
                          </p>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-900">Documents</p>
                            {documentsWorkspace.documents
                              .filter((document) => document.status === "GENERATED" && !!document.fileKey)
                              .map((document) => (
                                <label key={document.id} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={selectedDocIds.includes(document.id)}
                                    onChange={(event) =>
                                      setSelectedDocIds((current) =>
                                        event.target.checked
                                          ? Array.from(new Set([...current, document.id]))
                                          : current.filter((id) => id !== document.id),
                                      )
                                    }
                                  />
                                  <span>{document.docType.replaceAll("_", " ")}</span>
                                </label>
                              ))}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input
                              value={buyerSignerName}
                              onChange={(event) => setBuyerSignerName(event.target.value)}
                              placeholder="Buyer signer name"
                            />
                            <Input
                              value={buyerSignerEmail}
                              onChange={(event) => setBuyerSignerEmail(event.target.value)}
                              placeholder="Buyer signer email"
                            />
                            <Input
                              value={dealerSignerName}
                              onChange={(event) => setDealerSignerName(event.target.value)}
                              placeholder="Dealer signer name (optional)"
                            />
                            <Input
                              value={dealerSignerEmail}
                              onChange={(event) => setDealerSignerEmail(event.target.value)}
                              placeholder="Dealer signer email (optional)"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={() => void sendForEsign()} disabled={sendingEsign}>
                              {sendingEsign ? "Sending..." : "Send Envelope"}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button onClick={() => void generateAllDocuments(false)} disabled={generatingDocs}>
                      <FileCheck2 className="mr-2 h-4 w-4" />
                      Generate All
                    </Button>
                    <Button variant="outline" onClick={() => void generateAllDocuments(true)} disabled={generatingDocs}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {documentsWorkspace.notices.map((notice, index) => (
                    <div key={`notice-${index}`} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {notice}
                    </div>
                  ))}

                  {checklistErrors.length > 0 ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                      <p className="mb-2 inline-flex items-center gap-2 font-semibold text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        Validation Errors
                      </p>
                      <ul className="space-y-1 text-red-700">
                        {checklistErrors.map((error) => (
                          <li key={error.code}>[{error.code}] {error.message}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {checklistWarnings.length > 0 ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                      <p className="mb-2 inline-flex items-center gap-2 font-semibold text-amber-700">
                        <FileWarning className="h-4 w-4" />
                        Warnings
                      </p>
                      <ul className="space-y-1 text-amber-800">
                        {checklistWarnings.map((warning) => (
                          <li key={warning.code}>[{warning.code}] {warning.message}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {documentsWorkspace.checklist.map((item) => (
                      <div key={item.docType} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">{item.docType.replaceAll("_", " ")}</p>
                            <p className="text-xs text-slate-500">{item.reason}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={item.templateAvailable ? "success" : "danger"}>
                              {item.templateAvailable ? "Template Ready" : "Missing Template"}
                            </Badge>
                            {item.latestStatus ? <StatusBadge status={item.latestStatus} /> : null}
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Template: {item.templateName ?? "None"} {item.templateVersion ? `(v${item.templateVersion})` : ""}
                        </p>
                        {item.latestDocumentId ? (
                          <div className="mt-2">
                            <Button asChild variant="outline" size="sm">
                              <a href={`/api/deals/${deal.id}/documents/${item.latestDocumentId}/download`} target="_blank" rel="noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Preview PDF
                              </a>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Generated Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {documentsWorkspace.documents.length === 0 ? (
                    <p className="text-sm text-slate-500">No generated documents yet.</p>
                  ) : null}
                  {documentsWorkspace.documents.map((document) => {
                    const checklistItem = checklistByDocType.get(document.docType);
                    return (
                      <div key={document.id} className="rounded border border-slate-200 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{document.docType.replaceAll("_", " ")}</p>
                            <p className="text-xs text-slate-500">
                              {document.template?.name ?? checklistItem?.templateName ?? "Template"}
                              {document.template?.version ? ` (v${document.template.version})` : ""}
                            </p>
                          </div>
                          <StatusBadge status={document.status} />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-xs text-slate-500">
                            Generated {document.generatedAt ? formatDate(document.generatedAt, "MMM d, yyyy h:mm a") : "N/A"}
                          </p>
                          <Button asChild variant="outline" size="sm" disabled={!document.fileKey}>
                            <a href={`/api/deals/${deal.id}/documents/${document.id}/download`} target="_blank" rel="noreferrer">
                              Preview
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Envelopes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {documentsWorkspace.envelopes.length === 0 ? (
                    <p className="text-sm text-slate-500">No envelopes created yet.</p>
                  ) : null}
                  {documentsWorkspace.envelopes.map((envelope) => {
                    const metadata = envelope.metadataJson ?? {};
                    const hasSigned = typeof metadata.signedCombinedFileKey === "string";
                    const canVoid = envelope.status !== "VOIDED" && envelope.status !== "COMPLETED";
                    return (
                      <div key={envelope.id} className="rounded border border-slate-200 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">{envelope.provider}</p>
                            <p className="text-xs text-slate-500">
                              Sent {envelope.sentAt ? formatDate(envelope.sentAt, "MMM d, yyyy h:mm a") : "N/A"}
                            </p>
                          </div>
                          <StatusBadge status={envelope.status} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {hasSigned ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={`/api/deals/${deal.id}/documents/envelopes/${envelope.id}/download-signed`} target="_blank" rel="noreferrer">
                                <Signature className="mr-2 h-4 w-4" />
                                Download signed
                              </a>
                            </Button>
                          ) : null}
                          {envelope.provider === "stub" && envelope.status !== "COMPLETED" && envelope.status !== "VOIDED" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={completingEnvelopeId === envelope.id}
                              onClick={() => void completeStubEnvelope(envelope.id)}
                            >
                              {completingEnvelopeId === envelope.id ? "Completing..." : "Complete signing"}
                            </Button>
                          ) : null}
                          {canVoid ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={voidingEnvelopeId === envelope.id}
                              onClick={() => void voidEnvelope(envelope.id)}
                            >
                              {voidingEnvelopeId === envelope.id ? "Voiding..." : "Void envelope"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stage Transitions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {DEAL_STAGES.map((stage) => (
                <Button
                  key={stage}
                  type="button"
                  variant={stage === deal.stage ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => updateStage(stage)}
                  disabled={updatingStage}
                >
                  {stage.replaceAll("_", " ")}
                </Button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deal.payments.length === 0 ? <p className="text-sm text-slate-500">No payments recorded.</p> : null}
              {deal.payments.map((payment) => (
                <div key={payment.id} className="rounded border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-900">{formatCurrency(payment.amount)}</p>
                  <p className="text-xs text-slate-500">{payment.method} • {formatDate(payment.postedAt, "MMM d, h:mm a")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
