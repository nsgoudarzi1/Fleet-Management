import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { OperationsReportsClient } from "@/components/modules/reports/operations-reports-client";
import { getOperationsReports } from "@/lib/services/reports";

export default async function ReportsPage() {
  const report = await getOperationsReports();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Operations Reports"
        description="Daily aging and exception views for inventory, quotes, funding, upfits, and document packs."
        badges={["Dealer Ops", "Exceptions"]}
        actions={
          <Button asChild variant="outline">
            <Link href="/operations/upfits">Open Upfits Queue</Link>
          </Button>
        }
      />
      <OperationsReportsClient report={report as never} />
    </div>
  );
}
