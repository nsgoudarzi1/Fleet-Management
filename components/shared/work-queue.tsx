import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type QueueItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  priority?: "high" | "normal";
};

type WorkQueueProps = {
  title: string;
  items: QueueItem[];
  emptyLabel: string;
};

export function WorkQueue({ title, items, emptyLabel }: WorkQueueProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : null}
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 transition-all duration-150 hover:-translate-y-px hover:border-accent-foreground/20 hover:bg-muted/40"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {item.priority === "high" ? <Badge variant="danger">Urgent</Badge> : null}
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
