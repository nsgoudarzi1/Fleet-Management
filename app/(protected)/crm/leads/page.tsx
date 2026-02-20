import Link from "next/link";
import { Plus } from "lucide-react";
import { LeadsListClient } from "@/components/modules/crm/leads-list-client";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listLeads } from "@/lib/services/crm";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = typeof params.q === "string" ? params.q : undefined;
  const stage = typeof params.stage === "string" ? params.stage : undefined;
  const page = Number(typeof params.page === "string" ? params.page : 1);

  const data = await listLeads({
    query,
    stage: stage as never,
    page,
    pageSize: 25,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <PageHeader
        title="CRM • Leads"
        description="Pipeline, SLA timers, and next action control."
        actions={
          <Button asChild>
            <Link href="/crm/leads?create=1">
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Link>
          </Button>
        }
      />
      <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <form className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
          <Input defaultValue={query} name="q" placeholder="Search source, notes, customer" />
          <select name="stage" defaultValue={stage ?? ""} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">All stages</option>
            <option value="NEW">NEW</option>
            <option value="CONTACTED">CONTACTED</option>
            <option value="QUALIFIED">QUALIFIED</option>
            <option value="APPOINTMENT_SET">APPOINTMENT SET</option>
            <option value="NEGOTIATION">NEGOTIATION</option>
            <option value="WON">WON</option>
            <option value="LOST">LOST</option>
          </select>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>
      </section>
      <LeadsListClient rows={data.items as never[]} />
      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-500">
          Page {data.page} of {totalPages} • {data.total} total leads
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={data.page <= 1}>
            <Link
              href={`/crm/leads?page=${Math.max(1, data.page - 1)}${query ? `&q=${encodeURIComponent(query)}` : ""}${stage ? `&stage=${stage}` : ""}`}
            >
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={data.page >= totalPages}>
            <Link
              href={`/crm/leads?page=${Math.min(totalPages, data.page + 1)}${query ? `&q=${encodeURIComponent(query)}` : ""}${stage ? `&stage=${stage}` : ""}`}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
