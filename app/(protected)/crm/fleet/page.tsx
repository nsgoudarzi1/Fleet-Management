import { FleetAccountsListClient } from "@/components/modules/crm/fleet-accounts-list-client";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { listFleetAccounts } from "@/lib/services/fleet-accounts";

export default async function FleetAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const q = typeof params.q === "string" ? params.q : undefined;
  const page = Number(typeof params.page === "string" ? params.page : 1);
  const data = await listFleetAccounts({ q, page, pageSize: 25 });

  return (
    <div>
      <PageHeader
        title="Fleet Accounts"
        description="Manage commercial customer groups, locations, and multi-unit purchasing relationships."
        badges={["CRM", "Commercial"]}
      />
      <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <form className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input name="q" defaultValue={q} placeholder="Search fleet accounts..." />
          <button type="submit" className="h-9 rounded-md border border-slate-300 px-3 text-sm">Filter</button>
        </form>
      </section>
      <FleetAccountsListClient rows={data.items as never[]} />
    </div>
  );
}
