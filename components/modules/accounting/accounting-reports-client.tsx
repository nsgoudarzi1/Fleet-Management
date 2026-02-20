"use client";

import Papa from "papaparse";
import { Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type TrialBalanceRow = { accountCode: string; accountName: string; debit: number; credit: number };
type IncomeStatement = { revenue: number; expense: number; netIncome: number };
type ROGrossRow = { roNumber: string; status: string; labor: number; parts: number; cost: number; gross: number; customerName: string; vehicle: string };
type PartsGrossSummary = { revenue: number; cost: number; gross: number };
type TechnicianProductivityRow = { technicianName: string; clockedHours: number; flatHours: number; efficiency: number };

export function AccountingReportsClient({
  trialBalance,
  incomeStatement,
  roGross,
  partsGrossSummary,
  technicianProductivity,
}: {
  trialBalance: TrialBalanceRow[];
  incomeStatement: IncomeStatement;
  roGross: ROGrossRow[];
  partsGrossSummary: PartsGrossSummary;
  technicianProductivity: TechnicianProductivityRow[];
}) {
  const exportCsv = (name: string, rows: Array<Record<string, unknown>>) => {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Tabs defaultValue="trial-balance" className="space-y-3">
      <TabsList>
        <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
        <TabsTrigger value="income">Income Statement</TabsTrigger>
        <TabsTrigger value="ro-gross">RO Gross</TabsTrigger>
        <TabsTrigger value="parts">Parts Gross</TabsTrigger>
        <TabsTrigger value="tech">Tech Productivity</TabsTrigger>
      </TabsList>

      <TabsContent value="trial-balance">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Trial Balance</CardTitle>
            <Button variant="outline" size="sm" onClick={() => exportCsv("trial-balance", trialBalance as never[])}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {trialBalance.map((row) => (
              <div key={row.accountCode} className="grid grid-cols-[120px_1fr_140px_140px] gap-2 rounded border border-slate-200 p-2 text-sm">
                <p className="font-medium text-slate-900">{row.accountCode}</p>
                <p>{row.accountName}</p>
                <p className="text-right">{formatCurrency(row.debit)}</p>
                <p className="text-right">{formatCurrency(row.credit)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="income">
        <Card>
          <CardHeader>
            <CardTitle>Income Statement (Simple)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between"><span>Revenue</span><span className="font-semibold">{formatCurrency(incomeStatement.revenue)}</span></div>
            <div className="flex items-center justify-between"><span>Expense</span><span className="font-semibold">{formatCurrency(incomeStatement.expense)}</span></div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2"><span>Net Income</span><span className="font-semibold">{formatCurrency(incomeStatement.netIncome)}</span></div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ro-gross">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>RO Gross Summary</CardTitle>
            <Button variant="outline" size="sm" onClick={() => exportCsv("ro-gross", roGross as never[])}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {roGross.map((row) => (
              <div key={row.roNumber} className="rounded border border-slate-200 p-2 text-sm">
                <p className="font-medium text-slate-900">{row.roNumber} • {row.customerName}</p>
                <p className="text-xs text-slate-500">{row.vehicle} • {row.status}</p>
                <p className="text-xs text-slate-600">Labor {formatCurrency(row.labor)} • Parts {formatCurrency(row.parts)} • Cost {formatCurrency(row.cost)} • Gross {formatCurrency(row.gross)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="parts">
        <Card>
          <CardHeader>
            <CardTitle>Parts Gross</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between"><span>Revenue</span><span className="font-semibold">{formatCurrency(partsGrossSummary.revenue)}</span></div>
            <div className="flex items-center justify-between"><span>Cost</span><span className="font-semibold">{formatCurrency(partsGrossSummary.cost)}</span></div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2"><span>Gross</span><span className="font-semibold">{formatCurrency(partsGrossSummary.gross)}</span></div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tech">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Technician Productivity</CardTitle>
            <Button variant="outline" size="sm" onClick={() => exportCsv("technician-productivity", technicianProductivity as never[])}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {technicianProductivity.map((row) => (
              <div key={row.technicianName} className="grid grid-cols-[1fr_120px_120px_120px] gap-2 rounded border border-slate-200 p-2 text-sm">
                <p className="font-medium text-slate-900">{row.technicianName}</p>
                <p className="text-right">{row.clockedHours.toFixed(2)} hrs</p>
                <p className="text-right">{row.flatHours.toFixed(2)} hrs</p>
                <p className="text-right">{row.efficiency.toFixed(1)}%</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
