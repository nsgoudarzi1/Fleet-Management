import Link from "next/link";
import { Plus } from "lucide-react";
import { DealsListClient } from "@/components/modules/deals/deals-list-client";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listDeals } from "@/lib/services/deals";

export default async function DealsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = typeof params.q === "string" ? params.q : undefined;
  const stage = typeof params.stage === "string" ? params.stage : undefined;
  const page = Number(typeof params.page === "string" ? params.page : 1);

  const data = await listDeals({
    query,
    stage: stage as never,
    page,
    pageSize: 25,
  });
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <PageHeader
        title="Deals Pipeline"
        description="Manage every deal from draft through delivery with clear stage ownership."
        badges={["Primary Workflow"]}
        actions={
          <Button asChild>
            <Link href="/deals/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Deal
            </Link>
          </Button>
        }
      />
      <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <form className="grid gap-2 sm:grid-cols-[1fr_220px_auto_auto]">
          <Input defaultValue={query} name="q" placeholder="Search deal #, customer, stock #" />
          <select name="stage" defaultValue={stage ?? ""} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">All stages</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="CONTRACTED">Contracted</option>
            <option value="DELIVERED">Delivered</option>
          </select>
          <Button type="submit" variant="outline">
            Filter Results
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/deals">Reset</Link>
          </Button>
        </form>
      </section>
      <DealsListClient rows={data.items as never[]} />
      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-500">
          Page {data.page} of {totalPages} | {data.total} total deals
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={data.page <= 1}>
            <Link
              href={`/deals?page=${Math.max(1, data.page - 1)}${query ? `&q=${encodeURIComponent(query)}` : ""}${stage ? `&stage=${stage}` : ""}`}
            >
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={data.page >= totalPages}>
            <Link
              href={`/deals?page=${Math.min(totalPages, data.page + 1)}${query ? `&q=${encodeURIComponent(query)}` : ""}${stage ? `&stage=${stage}` : ""}`}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

