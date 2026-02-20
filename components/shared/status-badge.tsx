import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: string;
};

const MAP: Record<string, "default" | "secondary" | "outline" | "success" | "warning" | "danger"> = {
  ACQUIRED: "secondary",
  RECON: "warning",
  READY: "success",
  LISTED: "default",
  ON_HOLD: "outline",
  SOLD: "secondary",
  DELIVERED: "success",
  NEW: "secondary",
  CONTACTED: "outline",
  QUALIFIED: "default",
  APPOINTMENT_SET: "warning",
  NEGOTIATION: "warning",
  WON: "success",
  LOST: "danger",
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "default",
  RECOMMENDED: "warning",
  CONTRACTED: "outline",
  SENT_FOR_SIGNATURE: "warning",
  PARTIALLY_SIGNED: "warning",
  COMPLETED: "success",
  VOIDED: "danger",
  FAILED: "danger",
  SENT: "warning",
  VIEWED: "outline",
  DECLINED: "danger",
  ERROR: "danger",
  PENDING: "secondary",
  IN_REVIEW: "warning",
  FUNDED: "success",
  HOLD: "danger",
  OPEN: "secondary",
  IN_PROGRESS: "warning",
  AWAITING_APPROVAL: "warning",
  CLOSED_INVOICED: "success",
  CHECKED_IN: "outline",
  NO_SHOW: "danger",
  CANCELED: "danger",
  DEAD: "danger",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge variant={MAP[status] ?? "outline"} className="capitalize">{status.replaceAll("_", " ").toLowerCase()}</Badge>;
}
