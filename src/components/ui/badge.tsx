import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1.5 rounded-full font-medium",
  {
    variants: {
      variant: {
        brand: "bg-brand-50 text-brand-700 ring-1 ring-brand-100",
        "brand-solid": "bg-brand-600 text-white",
        neutral: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
        outline: "text-slate-600 ring-1 ring-slate-200",
      },
      size: {
        sm: "px-2.5 py-0.5 text-xs",
        md: "px-3 py-1 text-[13px]",
      },
    },
    defaultVariants: { variant: "brand", size: "sm" },
  },
);

export interface BadgeProps
  extends ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { badgeVariants };
