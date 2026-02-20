"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: { id: string; name: string | null; email: string } | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string | Date;
};

export function AuditViewerClient({ initialItems }: { initialItems: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const items = useMemo(
    () =>
      query.trim()
        ? initialItems.filter((item) =>
            `${item.entityType} ${item.entityId} ${item.actor?.email ?? ""}`.toLowerCase().includes(query.toLowerCase()),
          )
        : initialItems,
    [initialItems, query],
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Audit Events</CardTitle>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter entity, id, actor" />
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="w-full rounded border border-slate-200 p-3 text-left hover:bg-slate-50"
            >
              <p className="font-medium text-slate-900">{item.action} {item.entityType}</p>
              <p className="text-xs text-slate-500">{item.entityId}</p>
              <p className="text-xs text-slate-500">{item.actor?.name ?? item.actor?.email ?? "System"} • {formatDate(item.createdAt, "MMM d, h:mm a")}</p>
            </button>
          ))}
          {items.length === 0 ? <p className="text-slate-500">No audit events found.</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Event Diff</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          {selected ? (
            <>
              <p className="font-medium text-slate-900">{selected.action} {selected.entityType}</p>
              <p className="text-slate-500">{selected.entityId}</p>
              <div>
                <p className="font-medium text-slate-900">Before</p>
                <pre className="overflow-auto rounded bg-slate-100 p-2">{JSON.stringify(selected.before ?? {}, null, 2)}</pre>
              </div>
              <div>
                <p className="font-medium text-slate-900">After</p>
                <pre className="overflow-auto rounded bg-slate-100 p-2">{JSON.stringify(selected.after ?? {}, null, 2)}</pre>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSelected(null)}>Clear</Button>
            </>
          ) : (
            <p className="text-slate-500">Select an event to view diff details.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

