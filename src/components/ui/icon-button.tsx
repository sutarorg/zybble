"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Square icon-only button with a minimum 40px touch target on mobile and a
 * visible focus ring. Always requires an accessible `label`.
 */
export function IconButton({
  label,
  children,
  className,
  size = "default",
  ...props
}: React.ComponentProps<"button"> & {
  label: string;
  size?: "default" | "sm";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "default" ? "size-10 sm:size-9.5" : "size-9 sm:size-8",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
