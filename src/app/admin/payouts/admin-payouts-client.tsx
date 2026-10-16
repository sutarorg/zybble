"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FileWarning,
  Lock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approvePayoutRequestAction,
  confirmManualPayoutPaidAction,
  markPayoutRequestFailedAction,
  rejectPayoutRequestAction,
  revealPayoutDestinationAction,
} from "@/app/admin/actions";
import { formatInr } from "@/lib/money";
import type {
  AdminCreatorBalanceRow,
  AdminPayoutAuditRow,
  AdminPayoutRequestRow,
} from "@/lib/server/admin";
import type { PlainPayoutDestination } from "@/lib/server/payout-crypto";

interface AdminPayoutsClientProps {
  requests: AdminPayoutRequestRow[];
  creatorBalances: AdminCreatorBalanceRow[];
  auditEvents: AdminPayoutAuditRow[];
  encryptionReady: boolean;
}

export function AdminPayoutsClient({
  requests,
  creatorBalances,
  auditEvents,
  encryptionReady,
}: AdminPayoutsClientProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [revealedMap, setRevealedMap] = React.useState<
    Record<string, PlainPayoutDestination>
  >({});
  const [revealingId, setRevealingId] = React.useState<string | null>(null);
  const [activeModal, setActiveModal] = React.useState<{
    type: "paid" | "reject" | "fail";
    request: AdminPayoutRequestRow;
  } | null>(null);

  // Mark-paid form state
  const [paymentReference, setPaymentReference] = React.useState("");
  const [paymentMethodUsed, setPaymentMethodUsed] = React.useState("upi");
  const [confirmedAmountMatches, setConfirmedAmountMatches] = React.useState(false);
  const [confirmedTransferSent, setConfirmedTransferSent] = React.useState(false);
  const [adminNote, setAdminNote] = React.useState("");

  // Reject / Fail reason state
  const [reason, setReason] = React.useState("");

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const filteredRequests = React.useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  async function handleReveal(requestId: string) {
    if (revealedMap[requestId]) {
      const next = { ...revealedMap };
      delete next[requestId];
      setRevealedMap(next);
      return;
    }
    setRevealingId(requestId);
    setFeedback(null);
    const res = await revealPayoutDestinationAction(requestId);
    setRevealingId(null);
    if (!res.ok || !res.destination) {
      setFeedback({
        kind: "err",
        text: res.error ?? "Could not decrypt payout destination",
      });
      return;
    }
    setRevealedMap((prev) => ({ ...prev, [requestId]: res.destination! }));
    router.refresh();
  }

  async function handleApprove(req: AdminPayoutRequestRow) {
    setBusyId(req.id);
    setFeedback(null);
    const res = await approvePayoutRequestAction({
      requestId: req.id,
      adminNote: "Approved for manual transfer",
    });
    setBusyId(null);
    if (!res.ok) {
      setFeedback({ kind: "err", text: res.error ?? "Could not approve request" });
      return;
    }
    setFeedback({ kind: "ok", text: res.message ?? "Payout request approved." });
    router.refresh();
  }

  function openPaidModal(req: AdminPayoutRequestRow) {
    setPaymentReference("");
    setPaymentMethodUsed(req.destinationMethod === "upi" ? "upi" : "bank_neft");
    setConfirmedAmountMatches(false);
    setConfirmedTransferSent(false);
    setAdminNote("");
    setFeedback(null);
    setActiveModal({ type: "paid", request: req });
  }

  function openReasonModal(type: "reject" | "fail", req: AdminPayoutRequestRow) {
    setReason("");
    setFeedback(null);
    setActiveModal({ type, request: req });
  }

  async function submitModal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeModal) return;
    const req = activeModal.request;
    setBusyId(req.id);
    setFeedback(null);

    if (activeModal.type === "paid") {
      const res = await confirmManualPayoutPaidAction({
        requestId: req.id,
        paymentReference,
        paymentMethodUsed,
        confirmedAmountPaise: req.amountPaise,
        confirmedAmountMatches,
        confirmedTransferSent,
        adminNote: adminNote.trim() || undefined,
      });
      setBusyId(null);
      if (!res.ok) {
        setFeedback({ kind: "err", text: res.error ?? "Could not confirm payout" });
        return;
      }
      setFeedback({ kind: "ok", text: res.message ?? "Payout marked paid." });
      setActiveModal(null);
      router.refresh();
      return;
    }

    if (activeModal.type === "reject") {
      const res = await rejectPayoutRequestAction({
        requestId: req.id,
        reason,
      });
      setBusyId(null);
      if (!res.ok) {
        setFeedback({ kind: "err", text: res.error ?? "Could not reject request" });
        return;
      }
      setFeedback({ kind: "ok", text: res.message ?? "Payout request rejected." });
      setActiveModal(null);
      router.refresh();
      return;
    }

    const res = await markPayoutRequestFailedAction({
      requestId: req.id,
      reason,
    });
    setBusyId(null);
    if (!res.ok) {
      setFeedback({ kind: "err", text: res.error ?? "Could not mark failed" });
      return;
    }
    setFeedback({ kind: "ok", text: res.message ?? "Payout marked failed." });
    setActiveModal(null);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {feedback ? (
        <div
          className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between ${
            feedback.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] underline ml-4"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Payout Requests Queue */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Manual payout requests</h2>
            <p className="text-xs text-muted-foreground">
              Review creator requests, reveal encrypted destination snapshots (audited), execute the
              transfer via your bank/UPI portal, and record the UTR reference.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "requested", "approved", "paid", "failed", "rejected", "cancelled"] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                    statusFilter === st
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            No payout requests match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Payout ID</th>
                  <th className="px-4 py-2.5 font-medium">Creator</th>
                  <th className="px-4 py-2.5 font-medium">Destination snapshot</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">UTR / Audit note</th>
                  <th className="px-4 py-2.5 font-medium text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {filteredRequests.map((req) => {
                  const revealed = revealedMap[req.id];
                  const canAct = req.status === "requested" || req.status === "approved";

                  return (
                    <tr key={req.id}>
                      <td className="px-4 py-3 font-mono text-[11px] font-medium whitespace-nowrap">
                        {req.publicId}
                        <p className="mt-0.5 font-sans text-[10.5px] text-muted-foreground">
                          {new Date(req.requestedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{req.creatorName}</p>
                        <p className="text-[11px] text-muted-foreground">{req.creatorEmail}</p>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                          Net earned: {formatInr(req.creatorBalance.netEarnedPaise)} · Paid:{" "}
                          {formatInr(req.creatorBalance.paidOutPaise)}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                              {req.destinationMethod}
                            </span>
                            <span className="font-mono">{req.destinationMasked}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Holder: <span className="font-mono">{req.destinationHolderMasked}</span>
                            {req.destinationBankLabel ? ` · ${req.destinationBankLabel}` : ""}
                          </p>

                          {revealed ? (
                            <div
                              data-testid={`revealed-destination-${req.id}`}
                              className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 space-y-1 text-[11px]"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-amber-800 dark:text-amber-300">
                                  Decrypted transfer details (audited)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleReveal(req.id)}
                                  className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground"
                                >
                                  <EyeOff className="h-3 w-3" /> Hide
                                </button>
                              </div>
                              <p>
                                Beneficiary:{" "}
                                <strong className="font-mono">{revealed.accountHolderName}</strong>
                              </p>
                              {revealed.method === "upi" ? (
                                <p className="flex items-center gap-1.5">
                                  UPI VPA: <strong className="font-mono">{revealed.upiId}</strong>
                                  <CopyChip value={revealed.upiId} />
                                </p>
                              ) : (
                                <>
                                  <p className="flex items-center gap-1.5">
                                    Account:{" "}
                                    <strong className="font-mono">{revealed.accountNumber}</strong>
                                    <CopyChip value={revealed.accountNumber} />
                                  </p>
                                  <p className="flex items-center gap-1.5">
                                    IFSC: <strong className="font-mono">{revealed.ifsc}</strong>
                                    <CopyChip value={revealed.ifsc} />
                                  </p>
                                </>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!encryptionReady || revealingId === req.id}
                              onClick={() => handleReveal(req.id)}
                              data-testid={`reveal-destination-btn-${req.id}`}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
                            >
                              <Eye className="h-3 w-3" />
                              {revealingId === req.id
                                ? "Decrypting & logging…"
                                : "Reveal full destination (audited)"}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatInr(req.amountPaise)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={req.status} />
                      </td>

                      <td className="px-4 py-3 text-muted-foreground max-w-xs">
                        {req.paymentReference ? (
                          <div>
                            <p className="font-mono text-foreground font-semibold">
                              UTR: {req.paymentReference}
                            </p>
                            <p className="text-[10.5px]">
                              Via {req.paymentMethodUsed?.toUpperCase() ?? "TRANSFER"}
                              {req.paidAt
                                ? ` · ${new Date(req.paidAt).toLocaleDateString("en-IN")}`
                                : ""}
                            </p>
                          </div>
                        ) : req.rejectionReason ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            Rejected: {req.rejectionReason}
                          </span>
                        ) : req.failureReason ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            Failed: {req.failureReason}
                          </span>
                        ) : req.creatorNote ? (
                          <span>Creator note: {req.creatorNote}</span>
                        ) : req.adminNote ? (
                          <span>{req.adminNote}</span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canAct ? (
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            {req.status === "requested" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs"
                                disabled={busyId === req.id}
                                onClick={() => handleApprove(req)}
                                data-testid={`approve-payout-btn-${req.id}`}
                              >
                                Approve
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 px-2.5 text-xs gap-1"
                              disabled={busyId === req.id}
                              onClick={() => openPaidModal(req)}
                              data-testid={`mark-paid-btn-${req.id}`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Mark paid
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-amber-700 hover:text-amber-800"
                              disabled={busyId === req.id}
                              onClick={() => openReasonModal("fail", req)}
                            >
                              <FileWarning className="h-3 w-3 mr-1" />
                              Failed
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                              disabled={busyId === req.id}
                              onClick={() => openReasonModal("reject", req)}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : req.status === "failed" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs"
                            disabled={busyId === req.id}
                            onClick={() => handleApprove(req)}
                          >
                            Re-approve
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation / Rejection Modal */}
      {activeModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            {activeModal.type === "paid" ? (
              <form onSubmit={submitModal} className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Manual Transfer Verification
                    </span>
                  </div>
                  <h3 className="text-base font-bold">
                    Confirm manual payout {activeModal.request.publicId}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Zybble does not initiate bank transfers automatically. Only mark this request as
                    paid <strong>after</strong> you have completed the transfer of{" "}
                    <strong className="text-foreground">
                      {formatInr(activeModal.request.amountPaise)}
                    </strong>{" "}
                    to <strong>{activeModal.request.creatorName}</strong> (
                    <span className="font-mono">{activeModal.request.destinationMasked}</span>) and
                    received a bank UTR or UPI reference number.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 text-xs">
                    <span className="font-medium">Transfer channel used</span>
                    <select
                      value={paymentMethodUsed}
                      onChange={(e) => setPaymentMethodUsed(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                    >
                      <option value="upi">UPI transfer</option>
                      <option value="bank_imps">Bank IMPS</option>
                      <option value="bank_neft">Bank NEFT</option>
                      <option value="bank_rtgs">Bank RTGS</option>
                      <option value="bank_transfer">Bank transfer (other)</option>
                    </select>
                  </label>

                  <label className="block space-y-1 text-xs">
                    <span className="font-medium">Bank UTR / UPI reference ID *</span>
                    <Input
                      name="paymentReference"
                      required
                      minLength={4}
                      maxLength={80}
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="e.g. 428914509812 / HDFC26101699"
                      className="font-mono uppercase"
                    />
                  </label>
                </div>

                <label className="block space-y-1 text-xs">
                  <span className="font-medium">Admin note (optional)</span>
                  <Input
                    name="adminNote"
                    maxLength={500}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Optional internal settlement note"
                  />
                </label>

                <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmedAmountMatches}
                      onChange={(e) => setConfirmedAmountMatches(e.target.checked)}
                      className="mt-0.5"
                      data-testid="confirm-amount-checkbox"
                    />
                    <span>
                      I confirm the exact amount transferred was{" "}
                      <strong>{formatInr(activeModal.request.amountPaise)}</strong> (INR).
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmedTransferSent}
                      onChange={(e) => setConfirmedTransferSent(e.target.checked)}
                      className="mt-0.5"
                      data-testid="confirm-sent-checkbox"
                    />
                    <span>
                      I confirm the external bank/UPI transfer has settled and the UTR/reference
                      above is genuine.
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      busyId === activeModal.request.id ||
                      paymentReference.trim().length < 4 ||
                      !confirmedAmountMatches ||
                      !confirmedTransferSent
                    }
                    data-testid="confirm-paid-submit"
                  >
                    {busyId === activeModal.request.id
                      ? "Recording…"
                      : `Confirm ${formatInr(activeModal.request.amountPaise)} paid`}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitModal} className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold">
                    {activeModal.type === "reject"
                      ? `Reject payout request ${activeModal.request.publicId}`
                      : `Mark payout request ${activeModal.request.publicId} as failed`}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    This releases{" "}
                    <strong className="text-foreground">
                      {formatInr(activeModal.request.amountPaise)}
                    </strong>{" "}
                    back into {activeModal.request.creatorName}&apos;s available balance and emails them
                    the reason below.
                  </p>
                </div>

                <label className="block space-y-1.5 text-xs">
                  <span className="font-medium">Reason (sent to creator) *</span>
                  <Input
                    required
                    minLength={5}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      activeModal.type === "reject"
                        ? "e.g., Beneficiary name does not match creator profile"
                        : "e.g., Bank rejected IMPS transfer due to invalid IFSC"
                    }
                  />
                </label>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={busyId === activeModal.request.id || reason.trim().length < 5}
                  >
                    {activeModal.type === "reject" ? "Reject & release balance" : "Mark failed & release balance"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {/* Creator Balances & Destinations Directory */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Creator balances & saved destinations</h2>
            <p className="text-xs text-muted-foreground">
              Reconciled per-creator earnings, commission, refund adjustments, reserved requests, and
              masked destinations.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{creatorBalances.length} creators</span>
        </div>

        {creatorBalances.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No creator accounts yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Creator</th>
                  <th className="px-4 py-2.5 font-medium">Saved destination (masked)</th>
                  <th className="px-4 py-2.5 font-medium text-right">Gross sales</th>
                  <th className="px-4 py-2.5 font-medium text-right">Commission</th>
                  <th className="px-4 py-2.5 font-medium text-right">Net earned</th>
                  <th className="px-4 py-2.5 font-medium text-right">Reserved</th>
                  <th className="px-4 py-2.5 font-medium text-right">Paid out</th>
                  <th className="px-4 py-2.5 font-medium text-right">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {creatorBalances.map((row) => (
                  <tr key={row.creatorId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.creatorName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.creatorEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.destinationMethod ? (
                        <div>
                          <span className="uppercase text-[10.5px] font-semibold text-muted-foreground">
                            {row.destinationMethod}
                          </span>{" "}
                          <span className="font-mono">{row.destinationMasked}</span>
                          {row.destinationBankLabel ? (
                            <span className="block text-[10.5px] text-muted-foreground">
                              {row.destinationBankLabel}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not saved yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatInr(row.grossPaise)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatInr(row.commissionPaise)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatInr(row.netEarnedPaise)}
                      {row.negativeAdjustmentPaise > 0 ? (
                        <span className="block text-[10.5px] text-amber-600">
                          -{formatInr(row.negativeAdjustmentPaise)} adj.
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-300">
                      {formatInr(row.reservedPendingPaise)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                      {formatInr(row.paidOutPaise)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatInr(row.availablePaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Audit Trail */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Payout security & audit trail</h2>
              <p className="text-xs text-muted-foreground">
                Immutable log of destination updates, admin destination reveals, approvals, and
                UTR confirmations.
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{auditEvents.length} recent events</span>
        </div>

        {auditEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No payout audit events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Timestamp</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium">Creator</th>
                  <th className="px-4 py-2.5 font-medium">Actor</th>
                  <th className="px-4 py-2.5 font-medium">Masked details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(ev.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] font-medium">{ev.action}</td>
                    <td className="px-4 py-2.5">{ev.creatorName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {ev.actorEmail ?? "Creator / System"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {formatAuditMetadata(ev.metadata)}
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

function StatusBadge({ status }: { status: AdminPayoutRequestRow["status"] }) {
  const map: Record<AdminPayoutRequestRow["status"], { label: string; cls: string }> = {
    requested: {
      label: "Requested",
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    approved: {
      label: "Approved · Ready",
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
  const item = map[status] ?? map.requested;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${item.cls}`}>
      {item.label}
    </span>
  );
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
    >
      <Copy className="h-2.5 w-2.5" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function formatAuditMetadata(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  if (meta.public_id) parts.push(String(meta.public_id));
  if (typeof meta.amount_paise === "number") parts.push(formatInr(meta.amount_paise));
  if (meta.destination_masked || meta.masked_destination) {
    parts.push(String(meta.destination_masked ?? meta.masked_destination));
  }
  if (meta.payment_reference) parts.push(`UTR:${String(meta.payment_reference)}`);
  if (meta.reason) parts.push(`Reason:${String(meta.reason)}`);
  return parts.join(" · ") || "—";
}
