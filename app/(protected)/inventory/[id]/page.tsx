import { notFound } from "next/navigation";
import { VehicleDetailClient } from "@/components/modules/inventory/vehicle-detail-client";
import { getVehicleDetail } from "@/lib/services/inventory";
import { AppError } from "@/lib/services/guard";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let vehicle;
  try {
    vehicle = await getVehicleDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  return <VehicleDetailClient vehicle={vehicle as never} />;
}
