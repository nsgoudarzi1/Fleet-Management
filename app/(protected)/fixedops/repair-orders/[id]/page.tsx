import { notFound } from "next/navigation";
import { RepairOrderDetailClient } from "@/components/modules/fixedops/repair-order-detail-client";
import { getRepairOrderDetail, listParts, listTechnicians } from "@/lib/services/fixedops";

export default async function RepairOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let repairOrder;
  let parts;
  let technicians;
  try {
    [repairOrder, parts, technicians] = await Promise.all([
      getRepairOrderDetail(id),
      listParts({ page: 1, pageSize: 300 }),
      listTechnicians(),
    ]);
  } catch {
    notFound();
  }
  return (
    <RepairOrderDetailClient
      repairOrder={repairOrder as never}
      partOptions={parts.items.map((part) => ({ id: part.id, label: `${part.partNumber} ${part.description}` }))}
      technicianOptions={technicians.map((technician) => ({ id: technician.id, label: technician.displayName }))}
    />
  );
}
