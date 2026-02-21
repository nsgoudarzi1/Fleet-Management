import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UpfitsQueueClient } from "@/components/modules/upfits/upfits-queue-client";
import { listUpfitJobs } from "@/lib/services/upfits";

export default async function UpfitsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const q = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const rows = await listUpfitJobs({ q, status });

  return (
    <div>
      <PageHeader
        title="Upfit Operations"
        description="Manage upfit vendors, milestones, and rollup costs that flow to deals and quotes."
        badges={["Work Queue", "Vendors"]}
        actions={
          <Button asChild variant="outline">
            <Link href="/quotes">View Quotes</Link>
          </Button>
        }
      />
      <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <form className="grid gap-2 sm:grid-cols-[1fr_220px_auto_auto]">
          <Input defaultValue={q} name="q" placeholder="Search notes or identifiers" />
          <select name="status" defaultValue={status ?? ""} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">All statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_PARTS">Waiting Parts</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELED">Canceled</option>
          </select>
          <Button type="submit" variant="outline">Filter</Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/operations/upfits">Reset</Link>
          </Button>
        </form>
      </section>
      <UpfitsQueueClient rows={rows as never[]} />
    </div>
  );
}
