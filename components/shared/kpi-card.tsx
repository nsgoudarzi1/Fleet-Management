import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  delta?: string;
};

export function KpiCard({ label, value, hint, icon, delta }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          {delta ? <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">{delta}</span> : null}
        </div>
        <div className="h-1.5 rounded-full bg-muted">
          <div className="h-1.5 w-1/2 rounded-full bg-accent-foreground/30" />
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
