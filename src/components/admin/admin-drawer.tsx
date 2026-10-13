"use client";

import { LocalizedText } from "@/components/providers/localized-text";
import * as React from "react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Right-side detail drawer used across the admin portal. */
export function AdminDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex w-full flex-col p-0", wide ? "max-w-lg sm:w-125" : "max-w-md sm:w-100")}
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="pr-8 text-left text-[15.5px] leading-snug"><LocalizedText text={title} /></SheetTitle>
          {description && <p className="text-[12.5px] text-muted-foreground"><LocalizedText text={description} /></p>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3.5">{footer}</div>}
        <SheetClose className="hidden" />
      </SheetContent>
    </Sheet>
  );
}
