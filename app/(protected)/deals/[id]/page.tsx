import { notFound } from "next/navigation";
import { DealDetailClient } from "@/components/modules/deals/deal-detail-client";
import { getDealDocumentsWorkspace } from "@/lib/documents/service";
import { getDealDetail } from "@/lib/services/deals";
import { AppError } from "@/lib/services/guard";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let deal;
  let documentsWorkspace;
  try {
    [deal, documentsWorkspace] = await Promise.all([getDealDetail(id), getDealDocumentsWorkspace(id)]);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  return <DealDetailClient deal={deal as never} documentsWorkspace={documentsWorkspace as never} />;
}
