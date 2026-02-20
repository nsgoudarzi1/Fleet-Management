import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { CoaManagerClient } from "@/components/modules/accounting/coa-manager-client";
import { listChartOfAccounts } from "@/lib/services/accounting";

export default async function CoaPage() {
  const { accounts, mappings } = await listChartOfAccounts();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart of Accounts"
        description="Org-level accounts and deterministic posting map configuration."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline"><Link href="/accounting/journals">Journals</Link></Button>
            <Button asChild variant="outline"><Link href="/accounting/reports">Reports</Link></Button>
          </div>
        }
      />
      <CoaManagerClient accounts={accounts as never[]} mappings={mappings as never[]} />
    </div>
  );
}
