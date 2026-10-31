import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800",
        secondary:
          "bg-white text-slate-900 ring-1 ring-slate-200 shadow-xs hover:bg-slate-50 hover:ring-slate-300",
        ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        inverse:
          "bg-white text-brand-700 shadow-xs hover:bg-brand-50 active:bg-brand-100",
        "outline-inverse":
          "text-white ring-1 ring-white/30 hover:bg-white/10 hover:ring-white/50",
      },
      size: {
        sm: "h-9 px-3.5 text-sm [&_svg]:size-4",
        default: "h-10 px-4 text-sm [&_svg]:size-4",
        lg: "h-11 px-5 text-[15px] [&_svg]:size-[18px]",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
