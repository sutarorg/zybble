"use client";

import * as React from "react";
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
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Button + confirmation dialog for an administrative server action.
 *
 * The callback is a real server action; this component only collects the
 * operator's confirmation and reason. Nothing here mutates state locally.
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
  reasonLabel,
  minReasonLength = 0,
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
  reasonLabel?: string;
  minReasonLength?: number;
  /** Receives the operator's optional reason and resolves to `{ ok, error? }`. */
  onAction: (reason: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  toastText: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await onAction(reason).then(
      (value) => value,
      () => ({ ok: false as const, error: "Something went wrong" })
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "The action failed");
      return;
    }
    setOpen(false);
    setReason("");
    toast.success(result.message ?? toastText);
  }

  const reasonTooShort = reason.trim().length < minReasonLength;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
        onClick={() => setOpen(true)}
      >
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>{confirmBody}</DialogDescription>
          </DialogHeader>

          {reasonLabel ? (
            <div>
              <Label htmlFor={`reason-${confirmTitle}`} className="mb-1.5 block text-[13px]">
                {reasonLabel}
              </Label>
              <Textarea
                id={`reason-${confirmTitle}`}
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={minReasonLength > 0 ? "Required — the creator sees this" : "Optional"}
              />
              {reasonTooShort ? (
                <p className="mt-1 text-[12px] text-amber-700">
                  Please write at least {minReasonLength} characters.
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-[13px] text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={danger ? "destructive" : "default"}
              onClick={() => void confirm()}
              disabled={busy || reasonTooShort}
            >
              {busy ? "Working…" : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}