import { notFound } from "next/navigation";
import { FleetAccountDetailClient } from "@/components/modules/crm/fleet-account-detail-client";
import { PageHeader } from "@/components/shared/page-header";
import { AppError } from "@/lib/services/guard";
import { getFleetAccountDetail } from "@/lib/services/fleet-accounts";

export default async function FleetAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let account;
  try {
    account = await getFleetAccountDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={account.name}
        description="Fleet account profile and quote history."
        breadcrumbs={[
          { label: "Fleet", href: "/crm/fleet" },
          { label: account.name },
        ]}
      />
      <FleetAccountDetailClient account={account as never} />
    </div>
  );
}
