import Link from "next/link";
import { QuotesListClient } from "@/components/modules/quotes/quotes-list-client";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listQuotes } from "@/lib/services/quotes";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const q = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const page = Number(typeof params.page === "string" ? params.page : 1);

  const data = await listQuotes({
    q,
    status: status as never,
    page,
    pageSize: 25,
  });

  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Build and track multi-unit quotes, approvals, and shareable proposals."
        badges={["Sales", "Commercial"]}
        actions={
          <Button asChild variant="outline">
            <Link href="/crm/fleet">Fleet Accounts</Link>
          </Button>
        }
      />
      <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <form className="grid gap-2 sm:grid-cols-[1fr_220px_auto_auto]">
          <Input defaultValue={q} name="q" placeholder="Search quote #, customer, fleet account" />
          <select name="status" defaultValue={status ?? ""} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="EXPIRED">Expired</option>
          </select>
          <Button type="submit" variant="outline">Filter</Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/quotes">Reset</Link>
          </Button>
        </form>
      </section>
      <QuotesListClient rows={data.items as never[]} />
    </div>
  );
}
