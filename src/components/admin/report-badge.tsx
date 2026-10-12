import type { ReportPriority, ReportStatus } from "@/types";
import { Badge } from "@/components/ui/badge";

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  if (status === "open") return <Badge variant="amber">Open</Badge>;
  if (status === "under_review") return <Badge variant="sky">Under Review</Badge>;
  if (status === "resolved") return <Badge variant="emerald">Resolved</Badge>;
  return <Badge variant="secondary">Dismissed</Badge>;
}

export function ReportPriorityBadge({ priority }: { priority: ReportPriority }) {
  if (priority === "high") return <Badge className="border-red-200 bg-red-50 text-red-600">High</Badge>;
  if (priority === "medium") return <Badge variant="amber">Medium</Badge>;
  return <Badge variant="secondary">Low</Badge>;
}
