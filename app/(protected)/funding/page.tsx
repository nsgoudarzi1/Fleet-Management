import { Role } from "@prisma/client";
import { FundingQueueClient } from "@/components/modules/funding/funding-queue-client";
import { PageHeader } from "@/components/shared/page-header";
import { requireOrgContext } from "@/lib/services/guard";
import { listFundingQueue } from "@/lib/services/funding";

export default async function FundingQueuePage() {
  await requireOrgContext(Role.VIEWER);
  const items = await listFundingQueue({});

  return (
    <div className="space-y-4">
      <PageHeader
        title="Funding Work Queue"
        description="Track aging contracts, clear stip blockers, and move lender cases to payout."
      />
      <FundingQueueClient initialItems={items as never[]} />
    </div>
  );
}

