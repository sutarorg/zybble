import { LocalizedText } from "@/components/providers/localized-text";
import { statusMeta } from "@/lib/creator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<string, string> = {
  draft: "border-zinc-200 bg-zinc-50 text-zinc-700",
  published: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  warning: "border-orange-200 bg-orange-50 text-orange-700",
  error: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-sky-200 bg-sky-50 text-sky-700",
};

const DOT_CLASS: Record<string, string> = {
  draft: "bg-zinc-400",
  published: "bg-emerald-500",
  pending: "bg-amber-500",
  warning: "bg-orange-500",
  error: "bg-red-500",
  neutral: "bg-sky-500",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = statusMeta(status);
  return (
    <Badge variant="outline" title={meta.description} className={cn("gap-1.5", TONE_CLASS[meta.tone], className)}>
      <span className={cn("size-1.5 rounded-full", DOT_CLASS[meta.tone])} aria-hidden />
      <LocalizedText text={meta.label} />
    </Badge>
  );
}