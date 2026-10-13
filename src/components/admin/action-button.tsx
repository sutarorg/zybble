"use client";

import { LocalizedText } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Button + confirmation dialog for simulated admin actions. Executes a
 * synchronous callback and surfaces a toast. The description always reminds
 * the operator this only changes mock data.
 */
export function ActionButton({
  label,
  icon: Icon,
  variant = "outline",
  size = "sm",
  confirmTitle,
  confirmBody,
  confirmLabel,
  danger,
  onAction,
  toastText,
  disabled,
  className,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  size?: "sm" | "default" | "lg";
  confirmTitle: string;
  confirmBody: string;
  confirmLabel: string;
  danger?: boolean;
  onAction: () => void;
  toastText: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button
        variant={danger ? "destructive" : variant}
        size={size}
        disabled={disabled}
        className={cn(variant === "link" && "h-auto p-0 text-destructive hover:bg-transparent", className)}
        onClick={() => setOpen(true)}
      >
        {Icon && <Icon aria-hidden />}
        <LocalizedText text={label} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle><LocalizedText text={confirmTitle} /></DialogTitle>
            <DialogDescription><LocalizedText text={confirmBody} /></DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground"><LocalizedText text={"Frontend simulation — this updates preview state in your browser only. Nothing changes on a server."} /></p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}><LocalizedText text={"Cancel"} /></Button>
            <Button
              variant={danger ? "destructive" : "default"}
              loading={busy}
              onClick={() => {
                setBusy(true);
                window.setTimeout(() => {
                  onAction();
                  setBusy(false);
                  setOpen(false);
                  toast.success(toastText);
                }, 500);
              }}
            >
              <LocalizedText text={confirmLabel} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
