import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[50dvh] place-items-center">
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Record not found</h2>
        <p className="mt-1 text-sm text-slate-500">The requested record does not exist in this organization.</p>
        <Button asChild className="mt-4">
          <Link href="/app">Back to Dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
