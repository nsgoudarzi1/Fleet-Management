import { cn } from "@/lib/utils";

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/80", className)} aria-hidden="true" />;
}

export function TableSkeletonRows({
  columns,
  rows = 8,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={`skeleton-${rowIndex}`} className="border-b border-border">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={`skeleton-${rowIndex}-${colIndex}`} className="p-3">
              <SkeletonBlock className={cn("h-4", colIndex === 0 ? "w-4" : "w-full max-w-[10rem]")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

