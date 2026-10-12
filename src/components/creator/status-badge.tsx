import type { CourseStatus } from "@/types";
import { STATUS_META } from "@/lib/creator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: CourseStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta.badge === "sky" ? "sky" : meta.badge} className={cn("gap-1.5", className)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </Badge>
  );
}
