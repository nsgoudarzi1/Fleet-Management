import { DataTable } from "@/components/tables/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";

type JournalEntryRow = {
  id: string;
  entryNumber: string;
  description: string;
  postedAt: string | Date;
  sourceType: string;
  sourceId: string | null;
  totalDebit: string | number;
  totalCredit: string | number;
  period: { periodKey: string } | null;
  lines: Array<{ id: string; account: { code: string; name: string }; debit: string | number; credit: string | number }>;
};

export function JournalsListClient({ rows }: { rows: JournalEntryRow[] }) {
  return (
    <DataTable
      rows={rows}
      storageKey="journals-table"
      columns={[
        { key: "postedAt", label: "Posted", render: (row: JournalEntryRow) => formatDate(row.postedAt, "MMM d, yyyy") },
        {
          key: "entryNumber",
          label: "Entry",
          render: (row: JournalEntryRow) => (
            <div>
              <p className="font-medium text-slate-900">{row.entryNumber}</p>
              <p className="text-xs text-slate-500">{row.sourceType} • {row.period?.periodKey ?? "No period"}</p>
            </div>
          ),
        },
        { key: "description", label: "Description" },
        { key: "totalDebit", label: "Debit", render: (row: JournalEntryRow) => formatCurrency(row.totalDebit) },
        { key: "totalCredit", label: "Credit", render: (row: JournalEntryRow) => formatCurrency(row.totalCredit) },
        { key: "lineCount", label: "Lines", render: (row: JournalEntryRow) => row.lines.length },
      ]}
      rowActions={(row) => (
        <details className="max-w-xs rounded border border-slate-200 bg-white p-2 text-left text-xs">
          <summary className="cursor-pointer font-medium text-slate-700">View Lines</summary>
          <div className="mt-2 space-y-1">
            {row.lines.map((line) => (
              <div key={line.id} className="rounded border border-slate-200 p-1">
                <p>{line.account.code} {line.account.name}</p>
                <p>Dr {formatCurrency(line.debit)} • Cr {formatCurrency(line.credit)}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    />
  );
}
