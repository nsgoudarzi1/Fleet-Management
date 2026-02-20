import { AccountingDashboardClient } from "@/components/modules/accounting/accounting-dashboard-client";
import { PageHeader } from "@/components/shared/page-header";
import { Role } from "@prisma/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { accountingReports, listPayments } from "@/lib/services/accounting";
import { requireOrgContext } from "@/lib/services/guard";

export default async function AccountingPage() {
  const ctx = await requireOrgContext(Role.VIEWER);
  const [{ items: payments }, reports, deals, customers] = await Promise.all([
    listPayments({ page: 1, pageSize: 100 }),
    accountingReports(),
    prisma.deal.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.customer.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounting / Cashier"
        description="Payments ledger, funding updates, and lightweight reports."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/accounting/coa">COA</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/accounting/journals">Journals</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/accounting/reports">Reports</Link>
            </Button>
          </div>
        }
      />
      <AccountingDashboardClient
        payments={payments as never[]}
        dealOptions={deals.map((deal) => ({ id: deal.id, label: deal.dealNumber }))}
        customerOptions={customers.map((customer) => ({
          id: customer.id,
          label: `${customer.firstName} ${customer.lastName}`,
        }))}
        salesLog={reports.salesLog as never[]}
        inventoryAging={reports.inventoryAging as never[]}
        reconSpendSummary={reports.reconSpendSummary}
      />
    </div>
  );
}
