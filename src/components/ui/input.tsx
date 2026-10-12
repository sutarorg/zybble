import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9.5 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs transition-[border,box-shadow] outline-none placeholder:text-zinc-400",
        "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-xs transition-[border,box-shadow] outline-none placeholder:text-zinc-400",
        "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
