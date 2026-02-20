import Link from "next/link";
import { Plus } from "lucide-react";
import { CustomersListClient } from "@/components/modules/crm/customers-list-client";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCustomers } from "@/lib/services/crm";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = typeof params.q === "string" ? params.q : undefined;
  const page = Number(typeof params.page === "string" ? params.page : 1);

  const data = await listCustomers({
    query,
    page,
    pageSize: 25,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <PageHeader
        title="CRM • Customers"
        description="Householding, communication timeline, and deal history."
        actions={
          <Button asChild>
            <Link href="/crm/customers?create=1">
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Link>
          </Button>
        }
      />
      <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <form className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input defaultValue={query} name="q" placeholder="Search by name, phone, email" />
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>
      </section>
      <CustomersListClient rows={data.items as never[]} />
      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-500">
          Page {data.page} of {totalPages} • {data.total} total customers
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={data.page <= 1}>
            <Link href={`/crm/customers?page=${Math.max(1, data.page - 1)}${query ? `&q=${encodeURIComponent(query)}` : ""}`}>
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={data.page >= totalPages}>
            <Link href={`/crm/customers?page=${Math.min(totalPages, data.page + 1)}${query ? `&q=${encodeURIComponent(query)}` : ""}`}>
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
