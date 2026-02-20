"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[50dvh] place-items-center">
      <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Something went wrong.</h2>
        <p className="mt-2 text-sm text-slate-500">{error.message}</p>
        <Button onClick={() => reset()} className="mt-4">
          Try again
        </Button>
      </div>
    </main>
  );
}
