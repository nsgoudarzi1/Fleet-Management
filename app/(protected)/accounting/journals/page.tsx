import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { JournalsListClient } from "@/components/modules/accounting/journals-list-client";
import { listJournalEntries } from "@/lib/services/accounting";

export default async function JournalsPage() {
  const journals = await listJournalEntries({ page: 1, pageSize: 200 });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Journal Entries"
        description="Balanced entries posted by source workflows and manual controls."
        actions={<Button asChild variant="outline"><Link href="/accounting/coa">COA + Posting Map</Link></Button>}
      />
      <JournalsListClient rows={journals.items as never[]} />
    </div>
  );
}
