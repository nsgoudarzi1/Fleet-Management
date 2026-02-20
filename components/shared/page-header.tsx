import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  badges?: string[];
  breadcrumbs?: Array<{ label: string; href?: string }>;
};

export function PageHeader({ title, description, actions, className, badges, breadcrumbs }: PageHeaderProps) {
  return (
    <section
      className={cn(
        "mb-5 flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      data-surface="card"
    >
      <div className="space-y-2">
        {breadcrumbs?.length ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                {crumb.href ? <Link href={crumb.href} className="hover:text-foreground">{crumb.label}</Link> : <span>{crumb.label}</span>}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-card-foreground">{title}</h1>
          {badges?.map((badge) => (
            <Badge key={badge} variant="outline">{badge}</Badge>
          ))}
        </div>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
