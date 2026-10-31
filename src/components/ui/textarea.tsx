import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full rounded-lg bg-white px-3.5 py-3 text-[15px] leading-7 text-slate-900 shadow-xs ring-1 ring-slate-200 transition placeholder:text-slate-500 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
