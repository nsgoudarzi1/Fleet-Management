import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AccountingReportsClient } from "@/components/modules/accounting/accounting-reports-client";
import { accountingDeepReports } from "@/lib/services/accounting";

export default async function AccountingReportsPage() {
  const reports = await accountingDeepReports();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounting Reports"
        description="Trial balance, income statement, service/parts gross, and technician productivity."
        actions={<Button asChild variant="outline"><Link href="/accounting/coa">COA + Posting Map</Link></Button>}
      />
      <AccountingReportsClient
        trialBalance={reports.trialBalance}
        incomeStatement={reports.incomeStatement}
        roGross={reports.roGross}
        partsGrossSummary={reports.partsGrossSummary}
        technicianProductivity={reports.technicianProductivity}
      />
    </div>
  );
}
