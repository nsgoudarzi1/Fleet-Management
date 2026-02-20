import { notFound } from "next/navigation";
import { LeadDetailClient } from "@/components/modules/crm/lead-detail-client";
import { getLeadDetail } from "@/lib/services/crm";
import { AppError } from "@/lib/services/guard";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let lead;
  try {
    lead = await getLeadDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  return <LeadDetailClient lead={lead as never} />;
}
