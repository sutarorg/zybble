import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Consistent horizontal rhythm across every marketing section. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="container"
      className={cn("mx-auto w-full max-w-7xl px-6 lg:px-8", className)}
      {...props}
    />
  );
}
