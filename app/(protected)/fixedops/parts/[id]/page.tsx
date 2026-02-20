import { notFound } from "next/navigation";
import { PartDetailClient } from "@/components/modules/fixedops/part-detail-client";
import { getPartDetail } from "@/lib/services/fixedops";

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let part;
  try {
    part = await getPartDetail(id);
  } catch {
    notFound();
  }
  return <PartDetailClient part={part as never} />;
}
