"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

export type SheetSide = "left" | "right" | "top" | "bottom";

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: SheetSide;
}) {
  const isEdgeRail = side === "left" || side === "right";
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col bg-background shadow-pop outline-none",
          isEdgeRail
            ? "inset-y-0 w-80 max-w-[85vw]"
            : "inset-x-0 max-h-[85dvh] pb-safe",
          side === "left" &&
            "left-0 border-r border-border data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
          side === "right" &&
            "right-0 border-l border-border data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
          side === "top" &&
            "top-0 overflow-y-auto border-b border-border pt-safe data-[state=open]:animate-in data-[state=open]:slide-in-from-top data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top",
          side === "bottom" &&
            "bottom-0 border-t border-border data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-2.5 right-2.5 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none">
          <X className="size-4.5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-4 pr-12", className)} {...props} />;
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-display pr-8 text-base font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription };
