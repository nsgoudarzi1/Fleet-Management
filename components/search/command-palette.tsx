"use client";

import { Command } from "cmdk";
import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type SearchItem = {
  id: string;
  type: string;
  label: string;
  subLabel: string;
  href: string;
};

const QUICK_ACTIONS = [
  { label: "Receive Vehicle", href: "/inventory?create=1" },
  { label: "Create Deal", href: "/deals/new" },
  { label: "Create Quote", href: "/quotes" },
  { label: "Open Fleet Accounts", href: "/crm/fleet" },
  { label: "Add Lead", href: "/crm/leads?create=1" },
  { label: "Create Upfit Job", href: "/operations/upfits" },
  { label: "View Ops Reports", href: "/reports" },
  { label: "Create Repair Order", href: "/fixedops/repair-orders" },
  { label: "New Service Appointment", href: "/fixedops/appointments" },
  { label: "Add Recon Task", href: "/inventory?recon=1" },
  { label: "Record Payment", href: "/accounting?payment=1" },
  { label: "Receive Parts", href: "/fixedops/parts" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || event.key === "/") {
        const target = event.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    const run = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: abort.signal,
        });
        if (!response.ok) return;
        const json = (await response.json()) as { data: SearchItem[] };
        setResults(json.data ?? []);
      } finally {
        setLoading(false);
      }
    };
    const timeout = setTimeout(run, 180);
    return () => {
      clearTimeout(timeout);
      abort.abort();
    };
  }, [query]);

  const actionItems = useMemo(() => QUICK_ACTIONS, []);

  const routeTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Button variant="outline" className="w-full justify-between text-muted-foreground sm:max-w-md" onClick={() => setOpen(true)}>
        <span className="inline-flex items-center gap-2">
          <Search className="h-4 w-4" />
          Search inventory, customers, and deals
        </span>
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]">Ctrl+K</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0">
          <Command className="rounded-lg border-0 bg-card">
            <div className="flex items-center border-b border-border px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search VIN, stock #, customer, deal #..."
                className="flex h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="px-2 py-8 text-center text-sm text-muted-foreground">
                {loading ? "Searching..." : "No results found."}
              </Command.Empty>

              <Command.Group heading="Actions" className="px-2 pb-2 pt-1 text-xs text-muted-foreground">
                {actionItems.map((item) => (
                  <Command.Item
                    key={item.label}
                    onSelect={() => routeTo(item.href)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-muted"
                  >
                    <Plus className="h-4 w-4 text-accent-foreground" />
                    {item.label}
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group heading="Results" className="px-2 pb-2 pt-1 text-xs text-muted-foreground">
                {results.map((item) => (
                  <Command.Item
                    key={`${item.type}-${item.id}`}
                    onSelect={() => routeTo(item.href)}
                    className="flex cursor-pointer flex-col items-start rounded-md px-2 py-2 data-[selected=true]:bg-muted"
                  >
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.subLabel}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
