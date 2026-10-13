import { LocalizedText } from "@/components/providers/localized-text";
import type { ReportPriority, ReportStatus } from "@/types";
import { Badge } from "@/components/ui/badge";

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  if (status === "open") return <Badge variant="amber"><LocalizedText text={"Open"} /></Badge>;
  if (status === "under_review") return <Badge variant="sky"><LocalizedText text={"Under Review"} /></Badge>;
  if (status === "resolved") return <Badge variant="emerald"><LocalizedText text={"Resolved"} /></Badge>;
  return <Badge variant="secondary"><LocalizedText text={"Dismissed"} /></Badge>;
}

export function ReportPriorityBadge({ priority }: { priority: ReportPriority }) {
  if (priority === "high") return <Badge className="border-red-200 bg-red-50 text-red-600"><LocalizedText text={"High"} /></Badge>;
  if (priority === "medium") return <Badge variant="amber"><LocalizedText text={"Medium"} /></Badge>;
  return <Badge variant="secondary"><LocalizedText text={"Low"} /></Badge>;
}
