import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppError } from "@/lib/services/guard";
import { getQuoteByShareToken } from "@/lib/services/quotes";
import { formatCurrency } from "@/lib/utils";

export default async function SharedQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let quote;
  try {
    quote = await getQuoteByShareToken(token);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Quote {quote.quoteNumber}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Status: {quote.status}</p>
          <p>Expires: {quote.expiresAt ? quote.expiresAt.toISOString().slice(0, 10) : "No expiration"}</p>
          <p>Total: {formatCurrency(Number(quote.total))}</p>
          <p>Gross: {formatCurrency(Number(quote.grossTotal))}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {quote.lines.map((line) => (
            <div key={line.id} className="rounded border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">{line.description}</p>
                <p>{formatCurrency(Number(line.lineTotal))}</p>
              </div>
              <p className="text-xs text-slate-500">Qty {Number(line.quantity)} • Unit {formatCurrency(Number(line.unitPrice))}</p>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <form action={`/api/quotes/share/${token}/accept`} method="post">
              <Button type="submit">Accept Quote</Button>
            </form>
            <Button asChild variant="outline">
              <Link href="/">Back</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
