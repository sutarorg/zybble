"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Lock,
  Send,
  Smartphone,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cancelCreatorPayoutRequest,
  requestCreatorPayout,
  savePayoutDestination,
} from "@/app/creator/actions";
import { formatInr, paiseToRupees } from "@/lib/money";
import type {
  CreatorPayoutDestinationView,
  CreatorPayoutRequestView,
} from "@/lib/server/payouts";

interface PayoutDestinationFormProps {
  currentDestination: CreatorPayoutDestinationView | null;
  encryptionReady: boolean;
}

export function PayoutDestinationForm({
  currentDestination,
  encryptionReady,
}: PayoutDestinationFormProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(!currentDestination);
  const [method, setMethod] = React.useState<"upi" | "bank">(
    currentDestination?.method ?? "upi"
  );
  const [accountHolderName, setAccountHolderName] = React.useState("");
  const [upiId, setUpiId] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [ifsc, setIfsc] = React.useState("");
  const [bankName, setBankName] = React.useState(
    currentDestination?.bankLabel ?? ""
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!encryptionReady) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const payload =
      method === "upi"
        ? {
            method: "upi" as const,
            accountHolderName,
            upiId,
          }
        : {
            method: "bank" as const,
            accountHolderName,
            accountNumber,
            ifsc: ifsc.toUpperCase(),
            bankName,
          };

    const result = await savePayoutDestination(payload);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Could not save your payout destination");
      return;
    }

    setMessage(result.message ?? "Payout destination saved.");
    setAccountHolderName("");
    setUpiId("");
    setAccountNumber("");
    setIfsc("");
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Active payout destination</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" /> AES-256-GCM encrypted
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Configure one active Indian payout destination (UPI ID or bank account). Full account
            numbers and UPI IDs are encrypted server-side before storage and are never shown on
            public pages, logs, emails, or client queries.
          </p>
        </div>

        {currentDestination && !editing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(true);
              setError(null);
              setMessage(null);
            }}
          >
            Replace destination
          </Button>
        ) : null}
      </div>

      {!encryptionReady ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Encryption key not configured</p>
            <p className="mt-0.5 text-amber-700/90 dark:text-amber-300/90">
              <code>PAYOUT_DETAILS_ENCRYPTION_KEY</code> (32-byte key) is missing or invalid in this
              environment. Saving new payout destinations is disabled until the server key is set.
            </p>
          </div>
        </div>
      ) : null}

      {currentDestination ? (
        <div className="rounded-lg border border-border/80 bg-muted/30 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                {currentDestination.method === "upi" ? "UPI (VPA)" : "Bank transfer (NEFT / IMPS)"}
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-300">
                {currentDestination.statusLabel}
              </span>
            </div>
            <p className="font-mono text-sm text-foreground">
              {currentDestination.maskedDestination}
              {currentDestination.bankLabel ? ` · ${currentDestination.bankLabel}` : ""}
            </p>
            <p className="text-muted-foreground">
              Beneficiary: <span className="font-mono">{currentDestination.maskedAccountHolder}</span>{" "}
              · Updated {new Date(currentDestination.updatedAt).toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMethod("upi")}
              data-testid="payout-method-upi"
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition ${
                method === "upi"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <Smartphone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="text-xs font-semibold">Option A · UPI ID (VPA)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Receive manual payouts to an Indian UPI handle (e.g., name@okaxis).
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMethod("bank")}
              data-testid="payout-method-bank"
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition ${
                method === "bank"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <Building2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="text-xs font-semibold">Option B · Bank account (IMPS / NEFT)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Receive manual payouts to an Indian bank account with an 11-character IFSC.
                </p>
              </div>
            </button>
          </div>

          {method === "upi" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Beneficiary / account holder name">
                <Input
                  name="accountHolderName"
                  required
                  minLength={2}
                  maxLength={120}
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="As registered on your bank / UPI app"
                />
              </Field>
              <Field label="UPI ID (VPA)">
                <Input
                  name="upiId"
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="creator@okaxis"
                  autoComplete="off"
                />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Account holder name">
                <Input
                  name="accountHolderName"
                  required
                  minLength={2}
                  maxLength={120}
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="As shown on your bank statement"
                />
              </Field>
              <Field label="Bank account number (6–18 digits)">
                <Input
                  name="accountNumber"
                  required
                  inputMode="numeric"
                  pattern="\d{6,18}"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="000012345678"
                  autoComplete="off"
                />
              </Field>
              <Field label="IFSC code (11 characters, 5th is 0)">
                <Input
                  name="ifsc"
                  required
                  maxLength={11}
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  placeholder="HDFC0001234"
                  className="uppercase font-mono"
                />
              </Field>
              <Field label="Bank / branch name (optional)">
                <Input
                  name="bankName"
                  maxLength={100}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="HDFC Bank · Indiranagar"
                />
              </Field>
            </div>
          )}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Saving details marks your destination as <strong>details saved · awaiting payout</strong>.
              Zybble does not claim bank verification until a manual transfer settles.
            </p>
            <div className="flex items-center gap-2">
              {currentDestination ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" size="sm" disabled={submitting || !encryptionReady}>
                {submitting ? "Encrypting & saving…" : "Save payout destination"}
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      {message ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}

interface PayoutRequestPanelProps {
  availablePaise: number;
  reservedPendingPaise: number;
  negativeAdjustmentPaise: number;
  currentDestination: CreatorPayoutDestinationView | null;
  requests: CreatorPayoutRequestView[];
}

export function PayoutRequestPanel({
  availablePaise,
  reservedPendingPaise,
  negativeAdjustmentPaise,
  currentDestination,
  requests,
}: PayoutRequestPanelProps) {
  const router = useRouter();
  const [amountRupees, setAmountRupees] = React.useState(
    availablePaise > 0 ? paiseToRupees(availablePaise) : ""
  );
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const res = await requestCreatorPayout({
      amountRupees,
      note: note.trim() || undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Could not submit your payout request");
      return;
    }

    setMessage(res.message ?? "Payout request submitted.");
    setAmountRupees("");
    setNote("");
    router.refresh();
  }

  async function handleCancel(requestId: string) {
    setCancellingId(requestId);
    setError(null);
    setMessage(null);
    const res = await cancelCreatorPayoutRequest(requestId);
    setCancellingId(null);
    if (!res.ok) {
      setError(res.error ?? "Could not cancel request");
      return;
    }
    setMessage(res.message ?? "Payout request cancelled.");
    router.refresh();
  }

  const canRequest = Boolean(currentDestination) && availablePaise > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Request a manual payout</h2>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Request all or part of your available INR balance. Requested amounts are immediately
              reserved so they cannot be requested twice while an administrator reviews and completes
              your bank or UPI transfer.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Available to request
            </p>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {formatInr(availablePaise)}
            </p>
          </div>
        </div>

        {negativeAdjustmentPaise > 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
            <strong>Balance adjustment:</strong> {formatInr(negativeAdjustmentPaise)} more has been paid
            out or reserved than the earnings on record. New course sales reduce this adjustment first,
            before additional balance becomes available.
          </div>
        ) : null}

        {!currentDestination ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Save a UPI ID or Indian bank account above before requesting a payout. You can continue
            publishing courses and earning sales before adding payout details.
          </div>
        ) : null}

        <form onSubmit={handleRequest} className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
          <Field label="Amount to request (INR ₹)">
            <div className="flex items-center gap-2">
              <Input
                name="amountRupees"
                required
                inputMode="decimal"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="0.00"
                disabled={!canRequest || submitting}
              />
              {availablePaise > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmountRupees(paiseToRupees(availablePaise))}
                  disabled={!canRequest || submitting}
                >
                  Max
                </Button>
              ) : null}
            </div>
          </Field>

          <Field label="Note for finance team (optional)">
            <Input
              name="note"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional invoice or reference note"
              disabled={!canRequest || submitting}
            />
          </Field>

          <div>
            <Button
              type="submit"
              className="w-full gap-1.5"
              disabled={!canRequest || submitting}
              data-testid="submit-payout-request"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Submitting request…" : "Request payout"}
            </Button>
          </div>
        </form>

        {reservedPendingPaise > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Currently reserved in active requests:{" "}
            <strong className="text-foreground">{formatInr(reservedPendingPaise)}</strong>
          </p>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {message ? <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Payout request history</h2>
            <p className="text-xs text-muted-foreground">
              Every request snapshots the masked destination and records the bank/UPI UTR reference
              when marked paid.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{requests.length} total</span>
        </div>

        {requests.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No payout requests submitted yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Request ID</th>
                  <th className="px-4 py-2.5 font-medium">Requested</th>
                  <th className="px-4 py-2.5 font-medium">Destination (snapshot)</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">UTR / Reference & notes</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-4 py-3 font-mono text-[11px] font-medium">
                      {req.publicId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(req.requestedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium uppercase text-[10.5px] text-muted-foreground">
                        {req.destinationMethod}
                      </span>{" "}
                      <span className="font-mono">{req.destinationMasked}</span>
                      {req.destinationBankLabel ? (
                        <span className="block text-[10.5px] text-muted-foreground">
                          {req.destinationBankLabel}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatInr(req.amountPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs">
                      {req.paymentReference ? (
                        <div>
                          <span className="font-mono text-foreground font-medium">
                            UTR: {req.paymentReference}
                          </span>
                          {req.paidAt ? (
                            <span className="block text-[10.5px]">
                              Paid {new Date(req.paidAt).toLocaleDateString("en-IN")}
                            </span>
                          ) : null}
                        </div>
                      ) : req.rejectionReason ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          Rejected: {req.rejectionReason}
                        </span>
                      ) : req.failureReason ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          Failed: {req.failureReason}
                        </span>
                      ) : req.adminNote ? (
                        <span>{req.adminNote}</span>
                      ) : req.creatorNote ? (
                        <span>Note: {req.creatorNote}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.status === "requested" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={cancellingId === req.id}
                          onClick={() => handleCancel(req.id)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          {cancellingId === req.id ? "Cancelling…" : "Cancel"}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: CreatorPayoutRequestView["status"] }) {
  const styles: Record<CreatorPayoutRequestView["status"], { label: string; cls: string }> = {
    requested: {
      label: "Requested",
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    approved: {
      label: "Approved · Queued",
      cls: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    },
    paid: {
      label: "Paid",
      cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    rejected: {
      label: "Rejected",
      cls: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
    failed: {
      label: "Failed",
      cls: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
    cancelled: {
      label: "Cancelled",
      cls: "border-border bg-muted text-muted-foreground",
    },
  };
  const s = styles[status] ?? styles.requested;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
