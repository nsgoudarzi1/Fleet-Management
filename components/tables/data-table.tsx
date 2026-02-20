"use client";

import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeletonRows } from "@/components/shared/skeletons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDensity } from "@/lib/hooks/use-density";
import { cn } from "@/lib/utils";

type Column<T> = {
  key: string;
  label: string;
  className?: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;
  hiddenByDefault?: boolean;
};

type DataTableProps<T extends { id: string }> = {
  rows: T[];
  columns: Array<Column<T>>;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  actions?: ReactNode;
  bulkActions?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  storageKey?: string;
  emptyLabel?: string;
  loading?: boolean;
  onRowOpen?: (row: T) => void;
  activeFilters?: Array<{ key: string; label: string; value: string }>;
  onClearFilters?: () => void;
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  selectedIds,
  onSelectedIdsChange,
  actions,
  bulkActions,
  rowActions,
  storageKey,
  emptyLabel = "No records found.",
  loading = false,
  onRowOpen,
  activeFilters,
  onClearFilters,
}: DataTableProps<T>) {
  const { density, setDensity } = useDensity();
  const [internalSelection, setInternalSelection] = useState<string[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(-1);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    const defaults = columns.filter((col) => col.hiddenByDefault).map((col) => col.key);
    if (typeof window === "undefined" || !storageKey) return defaults;
    const raw = window.localStorage.getItem(`${storageKey}:hiddenColumns`);
    if (!raw) return defaults;
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return defaults;
    }
  });

  const activeSelection = selectedIds ?? internalSelection;
  const setSelection = onSelectedIdsChange ?? setInternalSelection;

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenColumns.includes(column.key)),
    [columns, hiddenColumns],
  );

  const allChecked = rows.length > 0 && rows.every((row) => activeSelection.includes(row.id));
  const safeActiveRowIndex = rows.length === 0 ? -1 : Math.min(activeRowIndex, rows.length - 1);

  const toggleColumn = (key: string, checked: boolean) => {
    const next = checked ? hiddenColumns.filter((item) => item !== key) : [...hiddenColumns, key];
    setHiddenColumns(next);
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(`${storageKey}:hiddenColumns`, JSON.stringify(next));
    }
  };

  const rowPadding = density === "compact" ? "py-1.5" : "py-2.5";

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!rows.length || !onRowOpen) return;
    const target = event.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName)) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveRowIndex((prev) => Math.min(prev + 1, rows.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveRowIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === "Enter" && safeActiveRowIndex >= 0) {
      event.preventDefault();
      onRowOpen(rows[safeActiveRowIndex]!);
    }
  };

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card shadow-xs" data-surface="card" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          {actions}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
          >
            Density: {density === "comfortable" ? "Comfortable" : "Compact"}
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.key}
                checked={!hiddenColumns.includes(column.key)}
                onCheckedChange={(checked) => toggleColumn(column.key, !!checked)}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {activeSelection.length > 0 ? (
        <div className="flex items-center justify-between border-b border-border bg-accent/40 px-3 py-2 text-sm transition-all duration-150">
          <p className="font-medium text-accent-foreground">{activeSelection.length} selected</p>
          <div className="flex items-center gap-2">
            {bulkActions}
            <Button size="sm" variant="ghost" onClick={() => setSelection([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {activeFilters?.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          {activeFilters.map((filter) => (
            <span key={filter.key} className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {filter.label}: {filter.value}
            </span>
          ))}
          {onClearFilters ? (
            <Button size="sm" variant="ghost" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
          <TableRow>
            <TableHead className="w-[44px]">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(checked) => setSelection(checked ? rows.map((row) => row.id) : [])}
                aria-label="Select all rows"
              />
            </TableHead>
            {visibleColumns.map((column) => (
              <TableHead key={column.key} className={cn(column.className, column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left")}>
                {column.label}
              </TableHead>
            ))}
            {rowActions ? <TableHead className="w-[110px] text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? <TableSkeletonRows columns={visibleColumns.length + (rowActions ? 2 : 1)} /> : null}
          {!loading && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visibleColumns.length + (rowActions ? 2 : 1)} className="p-6">
                <EmptyState title={emptyLabel} description="Try adjusting filters or saved views." />
              </TableCell>
            </TableRow>
          ) : null}
          {!loading && rows.map((row) => {
            const selected = activeSelection.includes(row.id);
            const active = safeActiveRowIndex >= 0 && rows[safeActiveRowIndex]?.id === row.id;
            return (
              <TableRow
                key={row.id}
                className={cn(
                  selected && "bg-accent/45",
                  active && "ring-1 ring-inset ring-ring/30",
                  onRowOpen ? "cursor-pointer" : undefined,
                )}
                onDoubleClick={() => onRowOpen?.(row)}
              >
                <TableCell className={rowPadding}>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) =>
                      setSelection(
                        checked ? [...activeSelection, row.id] : activeSelection.filter((id) => id !== row.id),
                      )
                    }
                    aria-label={`Select row ${row.id}`}
                  />
                </TableCell>
                {visibleColumns.map((column) => (
                  <TableCell key={`${row.id}-${column.key}`} className={cn(rowPadding, column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left")}>
                    {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "-")}
                  </TableCell>
                ))}
                {rowActions ? (
                  <TableCell className={cn("text-right", rowPadding)}>
                    <div className="inline-flex items-center justify-end gap-1">{rowActions(row)}</div>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
