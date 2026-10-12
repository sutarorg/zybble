import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  description,
  viewAllHref,
  onViewAll,
  actions,
  className,
}: {
  title: string;
  description?: string;
  viewAllHref?: string;
  onViewAll?: () => void;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="group flex items-center gap-1 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
          >
            View all
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="group flex cursor-pointer items-center gap-1 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
          >
            View all
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
