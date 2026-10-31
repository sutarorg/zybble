import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full rounded-lg bg-white px-3.5 text-[15px] text-slate-900 shadow-xs ring-1 ring-slate-200 transition placeholder:text-slate-500 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
