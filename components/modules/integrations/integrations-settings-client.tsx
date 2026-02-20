"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, RefreshCw, Send, Trash2, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string | Date;
  expiresAt: string | Date | null;
  lastUsedAt: string | Date | null;
};

type WebhookEndpointRow = {
  id: string;
  name: string;
  targetUrl: string;
  eventTypes: string[];
  isActive: boolean;
};

type DeliveryRow = {
  id: string;
  status: string;
  attemptCount: number;
  nextAttemptAt: string | Date;
  deliveredAt: string | Date | null;
  responseStatus: number | null;
  errorMessage: string | null;
  endpoint: { id: string; name: string };
  webhookEvent: { id: string; eventType: string; entityType: string; entityId: string };
};

const ALL_SCOPES = [
  "VEHICLES_READ",
  "VEHICLES_WRITE",
  "CUSTOMERS_READ",
  "CUSTOMERS_WRITE",
  "DEALS_READ",
  "DEALS_WRITE",
  "REPAIR_ORDERS_READ",
  "REPAIR_ORDERS_WRITE",
] as const;

export function IntegrationsSettingsClient({
  apiKeys,
  webhooks,
  deliveries,
}: {
  apiKeys: ApiKeyRow[];
  webhooks: WebhookEndpointRow[];
  deliveries: DeliveryRow[];
}) {
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);

  const runDeliveries = async () => {
    const response = await fetch("/api/integrations/webhooks/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 20 }),
    });
    if (!response.ok) {
      toast.error("Failed to run webhook delivery worker.");
      return;
    }
    toast.success("Webhook delivery run complete.");
    window.location.reload();
  };

  const redeliver = async (deliveryId: string) => {
    const response = await fetch("/api/integrations/deliveries/redeliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId }),
    });
    if (!response.ok) {
      toast.error("Unable to queue redelivery.");
      return;
    }
    toast.success("Delivery queued for redelivery.");
    window.location.reload();
  };

  const redeliverEvent = async (webhookEventId: string) => {
    const response = await fetch("/api/integrations/deliveries/redeliver-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookEventId }),
    });
    if (!response.ok) {
      toast.error("Unable to queue event redelivery.");
      return;
    }
    toast.success("Event deliveries queued for redelivery.");
    window.location.reload();
  };

  const revokeKey = async (id: string) => {
    if (!window.confirm("Revoke this API key?")) return;
    const response = await fetch(`/api/integrations/api-keys/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Unable to revoke API key.");
      return;
    }
    toast.success("API key revoked.");
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {revealedApiKey ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">New API key (shown once)</p>
          <code className="block break-all text-xs">{revealedApiKey}</code>
        </div>
      ) : null}
      {revealedSecret ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">New Webhook Secret (shown once)</p>
          <code className="block break-all text-xs">{revealedSecret}</code>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="inline-flex items-center gap-2"><KeyRound className="h-4 w-4" />API Keys</CardTitle>
            <CreateApiKeyDialog onCreated={(rawKey) => setRevealedApiKey(rawKey)} />
          </CardHeader>
          <CardContent className="space-y-2">
            {apiKeys.map((key) => (
              <div key={key.id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{key.name}</p>
                    <p className="text-xs text-slate-500">{key.keyPrefix} - Created {formatDate(key.createdAt, "MMM d, yyyy")}</p>
                  </div>
                  <StatusBadge status={key.isActive ? "APPROVED" : "VOIDED"} />
                </div>
                <p className="mt-1 text-xs text-slate-500">Scopes: {key.scopes.join(", ")}</p>
                <p className="mt-1 text-xs text-slate-500">Last used: {key.lastUsedAt ? formatDate(key.lastUsedAt, "MMM d, h:mm a") : "Never"}</p>
                <div className="mt-2 flex justify-end">
                  {key.isActive ? (
                    <Button size="sm" variant="outline" onClick={() => void revokeKey(key.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {apiKeys.length === 0 ? <p className="text-sm text-slate-500">No API keys yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="inline-flex items-center gap-2"><Webhook className="h-4 w-4" />Webhook Endpoints</CardTitle>
            <CreateWebhookDialog onCreated={(secret) => setRevealedSecret(secret)} />
          </CardHeader>
          <CardContent className="space-y-2">
            {webhooks.map((endpoint) => (
              <div key={endpoint.id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{endpoint.name}</p>
                    <p className="text-xs text-slate-500">{endpoint.targetUrl}</p>
                  </div>
                  <StatusBadge status={endpoint.isActive ? "APPROVED" : "VOIDED"} />
                </div>
                <p className="mt-1 text-xs text-slate-500">Events: {endpoint.eventTypes.join(", ")}</p>
              </div>
            ))}
            {webhooks.length === 0 ? <p className="text-sm text-slate-500">No webhook endpoints configured.</p> : null}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Webhook Deliveries</CardTitle>
          <Button size="sm" variant="outline" onClick={() => void runDeliveries()}>
            <RefreshCw className="mr-2 h-4 w-4" />Run Worker Now
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {deliveries.map((delivery) => (
            <div key={delivery.id} className="rounded border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{delivery.webhookEvent.eventType}</p>
                  <p className="text-xs text-slate-500">{delivery.endpoint.name} - Attempt {delivery.attemptCount}</p>
                </div>
                <StatusBadge status={delivery.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Next: {formatDate(delivery.nextAttemptAt, "MMM d, h:mm a")} - Last response: {delivery.responseStatus ?? "n/a"}
              </p>
              {delivery.errorMessage ? <p className="mt-1 text-xs text-red-600">{delivery.errorMessage}</p> : null}
              {(delivery.status === "FAILED" || delivery.status === "DEAD") ? (
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => void redeliver(delivery.id)}>
                    <Send className="mr-2 h-4 w-4" />Redeliver
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void redeliverEvent(delivery.webhookEvent.id)}>
                    <RefreshCw className="mr-2 h-4 w-4" />Redeliver Event
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          {deliveries.length === 0 ? <p className="text-sm text-slate-500">No delivery records yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateApiKeyDialog({ onCreated }: { onCreated: (rawKey: string) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const createKey = async (formData: FormData) => {
    setSaving(true);
    const selectedScopes = ALL_SCOPES.filter((scope) => formData.get(scope) === "on");
    const response = await fetch("/api/integrations/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        scopes: selectedScopes,
      }),
    });
    setSaving(false);

    if (!response.ok) {
      toast.error("Unable to create API key.");
      return;
    }

    const payload = (await response.json()) as { data: { rawKey: string } };
    onCreated(payload.data.rawKey);
    toast.success("API key created.");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Create Key</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create API Key</DialogTitle></DialogHeader>
        <form action={createKey} className="space-y-3">
          <Input name="name" placeholder="Integration name" required />
          <div className="grid grid-cols-2 gap-2 text-sm">
            {ALL_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-2">
                <input type="checkbox" name={scope} defaultChecked={scope.endsWith("READ")} />
                {scope}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateWebhookDialog({ onCreated }: { onCreated: (secret: string) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const createWebhook = async (formData: FormData) => {
    setSaving(true);
    const eventTypes = String(formData.get("eventTypes") ?? "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const response = await fetch("/api/integrations/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        targetUrl: String(formData.get("targetUrl") ?? ""),
        eventTypes,
      }),
    });

    setSaving(false);
    if (!response.ok) {
      toast.error("Unable to create webhook endpoint.");
      return;
    }

    const payload = (await response.json()) as { data: { secret: string } };
    onCreated(payload.data.secret);
    toast.success("Webhook endpoint created.");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Add Webhook</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Webhook Endpoint</DialogTitle></DialogHeader>
        <form action={createWebhook} className="space-y-3">
          <Input name="name" placeholder="Endpoint name" required />
          <Input name="targetUrl" placeholder="https://example.com/webhooks" required />
          <Textarea
            name="eventTypes"
            rows={6}
            defaultValue={"repairOrder.closed\npart.transaction.created\njournalEntry.posted"}
            placeholder="One event type per line"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
