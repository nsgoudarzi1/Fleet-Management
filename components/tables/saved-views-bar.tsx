"use client";

import { BookmarkPlus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SavedView = {
  id: string;
  name: string;
  filterJson: Record<string, string>;
};

type SavedViewsBarProps = {
  entityKey: string;
};

function queryFromSearchParams(searchParams: URLSearchParams) {
  const obj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

export function SavedViewsBar({ entityKey }: SavedViewsBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");

  const queryJson = useMemo(() => queryFromSearchParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const queryEntries = useMemo(
    () => Object.entries(queryJson).filter(([, value]) => String(value).trim().length > 0),
    [queryJson],
  );

  const load = useCallback(async () => {
    const response = await fetch(`/api/saved-views?entityKey=${entityKey}`);
    if (!response.ok) return;
    const json = (await response.json()) as { data: SavedView[] };
    setViews(json.data ?? []);
  }, [entityKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const save = async () => {
    if (!name.trim()) return;
    const response = await fetch("/api/saved-views", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entityKey,
        name: name.trim(),
        filterJson: queryJson,
      }),
    });
    if (!response.ok) {
      toast.error("Unable to save view");
      return;
    }
    setName("");
    toast.success("View saved");
    await load();
  };

  const applyView = (view: SavedView) => {
    const params = new URLSearchParams();
    Object.entries(view.filterJson ?? {}).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  const remove = async (id: string) => {
    const response = await fetch(`/api/saved-views?id=${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Unable to remove view");
      return;
    }
    toast.success("View removed");
    await load();
  };

  const clearFilters = () => {
    router.push(pathname);
  };

  return (
    <div className="mb-3 rounded-[var(--radius)] border border-border bg-card p-3 shadow-xs" data-surface="card">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Save current filters as a reusable view"
              className="max-w-sm"
            />
            <Button type="button" size="sm" variant="outline" onClick={save}>
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Save View
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {views.map((view) => (
              <div
                key={view.id}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-1"
              >
                <button
                  type="button"
                  onClick={() => applyView(view)}
                  className="text-xs font-medium text-foreground transition-colors hover:text-accent-foreground"
                >
                  {view.name}
                </button>
                <button
                  type="button"
                  onClick={() => remove(view.id)}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {queryEntries.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
            {queryEntries.map(([key, value]) => (
              <span key={key} className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {key}: {value}
              </span>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Clear All Filters
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
