import { notFound } from "next/navigation";
import { CustomerDetailClient } from "@/components/modules/crm/customer-detail-client";
import { getCustomerDetail } from "@/lib/services/crm";
import { AppError } from "@/lib/services/guard";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let customer;
  try {
    customer = await getCustomerDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  return <CustomerDetailClient customer={customer as never} />;
}
