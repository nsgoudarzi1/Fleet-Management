import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PartsListClient } from "@/components/modules/fixedops/parts-list-client";
import { listPartVendors, listParts } from "@/lib/services/fixedops";

export default async function PartsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = typeof params.q === "string" ? params.q : undefined;

  const [parts, vendors] = await Promise.all([
    listParts({ query, page: 1, pageSize: 150 }),
    listPartVendors(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Parts" description="Catalog, receiving, allocations, and cycle-count controls." />
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <form className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input name="q" defaultValue={query} placeholder="Search part #, description, bin" />
          <Button type="submit" variant="outline">Apply</Button>
        </form>
      </section>
      <PartsListClient
        rows={parts.items as never[]}
        vendorOptions={vendors.map((vendor) => ({ id: vendor.id, label: vendor.name }))}
      />
    </div>
  );
}
