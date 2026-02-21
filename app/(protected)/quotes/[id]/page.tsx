import { notFound } from "next/navigation";
import { QuoteDetailClient } from "@/components/modules/quotes/quote-detail-client";
import { PageHeader } from "@/components/shared/page-header";
import { AppError } from "@/lib/services/guard";
import { getQuoteDetail } from "@/lib/services/quotes";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let quote;
  try {
    quote = await getQuoteDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={quote.quoteNumber}
        description="Quote lines, pricing, approvals, and upfit costs."
        breadcrumbs={[
          { label: "Quotes", href: "/quotes" },
          { label: quote.quoteNumber },
        ]}
      />
      <QuoteDetailClient quote={quote as never} />
    </div>
  );
}
