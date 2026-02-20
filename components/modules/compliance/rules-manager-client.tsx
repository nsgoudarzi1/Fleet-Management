"use client";

import { RefreshCw, Save, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

type RuleSetRow = {
  id: string;
  orgId: string | null;
  jurisdiction: string;
  version: number;
  effectiveFrom: string | Date;
  effectiveTo: string | Date | null;
  rulesJson: Record<string, unknown>;
};

const SAMPLE_DEAL_SNAPSHOT = `{
  "dealId": "sample-deal",
  "orgId": "sample-org",
  "jurisdiction": "TX",
  "buyerState": "TX",
  "dealType": "FINANCE",
  "hasTradeIn": true,
  "isFinanced": true,
  "hasLienholder": true,
  "salePrice": 24000,
  "financedAmount": 21000,
  "customer": { "firstName": "Jordan", "lastName": "Miles", "email": "jordan@example.com", "phone": "555-0101" },
  "vehicle": { "year": 2022, "make": "Toyota", "model": "Camry", "vin": "4T1X11AK4NU123456", "mileage": 24000, "stockNumber": "STK-88" },
  "dealer": { "name": "Summit Auto Group", "taxRate": 0.075, "docFee": 499, "licenseFee": 199 }
}`;

export function RulesManagerClient() {
  const [jurisdiction, setJurisdiction] = useState("TX");
  const [rows, setRows] = useState<RuleSetRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [editorJson, setEditorJson] = useState("");
  const [originalJson, setOriginalJson] = useState("");
  const [snapshotJson, setSnapshotJson] = useState(SAMPLE_DEAL_SNAPSHOT);
  const [evaluation, setEvaluation] = useState<{
    requiredDocs: Array<{ docType: string; reason: string }>;
    validationErrors: Array<{ code: string; message: string; severity: string }>;
    computedFields: Record<string, unknown>;
    notices: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const changedLines = useMemo(() => {
    const before = originalJson.split("\n");
    const after = editorJson.split("\n");
    const max = Math.max(before.length, after.length);
    let changed = 0;
    for (let index = 0; index < max; index++) {
      if (before[index] !== after[index]) changed += 1;
    }
    return changed;
  }, [editorJson, originalJson]);

  const loadRules = async () => {
    setLoading(true);
    const response = await fetch(`/api/compliance/rulesets?jurisdiction=${encodeURIComponent(jurisdiction)}`);
    setLoading(false);
    if (!response.ok) {
      toast.error("Unable to load rulesets.");
      return;
    }
    const payload = (await response.json()) as {
      data: { items: RuleSetRow[] };
    };
    setRows(payload.data.items);
    if (payload.data.items.length > 0) {
      const first = payload.data.items[0];
      setSelectedId(first.id);
      const json = JSON.stringify(first.rulesJson, null, 2);
      setEditorJson(json);
      setOriginalJson(json);
    } else {
      setSelectedId("");
      setEditorJson("");
      setOriginalJson("");
    }
  };

  useEffect(() => {
    void loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jurisdiction]);

  const selectRuleSet = (ruleSet: RuleSetRow) => {
    setSelectedId(ruleSet.id);
    const json = JSON.stringify(ruleSet.rulesJson, null, 2);
    setEditorJson(json);
    setOriginalJson(json);
  };

  const saveRuleSet = async () => {
    if (!selectedId) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(editorJson);
    } catch {
      toast.error("Rules JSON is invalid.");
      return;
    }
    const response = await fetch(`/api/compliance/rulesets/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rulesJson: parsed,
      }),
    });
    if (!response.ok) {
      toast.error("Unable to save ruleset.");
      return;
    }
    toast.success("Ruleset saved.");
    setOriginalJson(editorJson);
    await loadRules();
  };

  const createVersion = async () => {
    const response = await fetch("/api/compliance/rulesets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jurisdiction,
        effectiveFrom: new Date().toISOString(),
        copyFromId: selectedId || undefined,
      }),
    });
    if (!response.ok) {
      toast.error("Unable to create ruleset version.");
      return;
    }
    toast.success("Ruleset version created.");
    await loadRules();
  };

  const runEvaluation = async () => {
    let parsedSnapshot: unknown;
    try {
      parsedSnapshot = JSON.parse(snapshotJson);
    } catch {
      toast.error("DealSnapshot JSON is invalid.");
      return;
    }
    const response = await fetch("/api/compliance/rulesets/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jurisdiction,
        dealSnapshot: parsedSnapshot,
      }),
    });
    if (!response.ok) {
      toast.error("Unable to evaluate rules.");
      return;
    }
    const payload = (await response.json()) as {
      data: {
        requiredDocs: Array<{ docType: string; reason: string }>;
        validationErrors: Array<{ code: string; message: string; severity: string }>;
        computedFields: Record<string, unknown>;
        notices: string[];
      };
    };
    setEvaluation(payload.data);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>RuleSets</CardTitle>
          <div className="flex items-center gap-2">
            <Input value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value.toUpperCase())} className="w-24" />
            <Button variant="outline" onClick={() => void loadRules()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => void createVersion()}>
              <Wand2 className="mr-2 h-4 w-4" />
              New Version
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Not legal advice. Validate all state/county/city requirements with licensed counsel.
          </p>
          {rows.map((row) => (
            <button
              type="button"
              key={row.id}
              onClick={() => selectRuleSet(row)}
              className={`w-full rounded border p-3 text-left text-sm ${row.id === selectedId ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">
                  {row.jurisdiction} v{row.version}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={row.orgId ? "outline" : "secondary"}>{row.orgId ? "Org" : "Global"}</Badge>
                  <span className="text-xs text-slate-500">
                    {formatDate(row.effectiveFrom, "MMM d, yyyy")} - {row.effectiveTo ? formatDate(row.effectiveTo, "MMM d, yyyy") : "Open"}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {rows.length === 0 ? <p className="text-sm text-slate-500">No rulesets for this jurisdiction.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rules JSON Editor</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{changedLines} changed lines</Badge>
            <Button onClick={() => void saveRuleSet()} disabled={!selectedRow}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea rows={20} value={editorJson} onChange={(event) => setEditorJson(event.target.value)} placeholder="Select a ruleset to edit." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Evaluation Harness</CardTitle>
          <Button variant="outline" onClick={() => void runEvaluation()}>
            Run Test
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          <Textarea rows={16} value={snapshotJson} onChange={(event) => setSnapshotJson(event.target.value)} />
          <div className="space-y-3 rounded border border-slate-200 p-3 text-sm">
            <p className="font-medium text-slate-900">Result</p>
            {!evaluation ? <p className="text-slate-500">Run a test to view checklist and validations.</p> : null}
            {evaluation?.notices?.map((notice, index) => (
              <p key={`${notice}-${index}`} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">{notice}</p>
            ))}
            {evaluation?.requiredDocs?.map((item) => (
              <div key={item.docType} className="rounded border border-slate-200 p-2">
                <p className="font-medium">{item.docType}</p>
                <p className="text-xs text-slate-500">{item.reason}</p>
              </div>
            ))}
            {evaluation?.validationErrors?.map((error) => (
              <div key={error.code} className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                [{error.severity}] {error.code}: {error.message}
              </div>
            ))}
            {evaluation ? (
              <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                {JSON.stringify(evaluation.computedFields, null, 2)}
              </pre>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
