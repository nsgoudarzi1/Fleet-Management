import Link from "next/link";
import { Plus } from "lucide-react";
import { InventoryListClient } from "@/components/modules/inventory/inventory-list-client";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listVehicles } from "@/lib/services/inventory";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const page = Number(typeof params.page === "string" ? params.page : 1);

  const data = await listVehicles({
    query,
    status: status as never,
    page,
    pageSize: 25,
  });

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <PageHeader
        title="Inventory & Vehicles"
        description="Acquisition through delivery with recon visibility."
        actions={
          <Button asChild>
            <Link href="/inventory?create=1">
              <Plus className="mr-2 h-4 w-4" />
              Receive Vehicle
            </Link>
          </Button>
        }
      />
      <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <form className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
          <Input defaultValue={query} name="q" placeholder="Search by VIN, stock, make, model" />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACQUIRED">Acquired</option>
            <option value="RECON">Recon</option>
            <option value="READY">Ready</option>
            <option value="LISTED">Listed</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="SOLD">Sold</option>
            <option value="DELIVERED">Delivered</option>
          </select>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>
      </section>

      <InventoryListClient rows={data.items as never[]} />

      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-500">
          Page {data.page} of {totalPages} • {data.total} total vehicles
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={data.page <= 1}>
            <Link href={`/inventory?page=${Math.max(1, data.page - 1)}${query ? `&q=${encodeURIComponent(query)}` : ""}${status ? `&status=${status}` : ""}`}>
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={data.page >= totalPages}>
            <Link href={`/inventory?page=${Math.min(totalPages, data.page + 1)}${query ? `&q=${encodeURIComponent(query)}` : ""}${status ? `&status=${status}` : ""}`}>
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
