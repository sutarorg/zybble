"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import {
  Ban,
  Check,
  CircleAlert,
  Clock3,
  Landmark,
  Wallet,
} from "lucide-react";
import type { AdminPayout } from "@/types";
import { useAdmin } from "@/components/providers/admin-provider";
import { formatDate } from "@/lib/format";
import { money, moneyExact } from "@/lib/creator";
import { StatCard } from "@/components/creator/stat-card";
import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { INSTRUCTORS } from "@/data/mock-data";
import { cn } from "@/lib/utils";

function PayoutStatusBadge({ status }: { status: AdminPayout["status"] }) {
  if (status === "requested") return <Badge variant="amber"><LocalizedText text={"Requested"} /></Badge>;
  if (status === "approved") return <Badge variant="sky"><LocalizedText text={"Approved"} /></Badge>;
  if (status === "paid") return <Badge variant="emerald"><LocalizedText text={"Paid"} /></Badge>;
  return <Badge className="border-red-200 bg-red-50 text-red-600"><LocalizedText text={"Rejected"} /></Badge>;
}

export default function AdminPayoutsPage() {
  const translateUi = useTranslate();
  const { hydrated, payouts, setPayoutStatus, settings } = useAdmin();
  const [statusFilter, setStatusFilter] = useState("all");

  const stats = useMemo(() => {
    return {
      requested: payouts.filter((p) => p.status === "requested").reduce((a, p) => a + p.amount, 0),
      approved: payouts.filter((p) => p.status === "approved").reduce((a, p) => a + p.amount, 0),
      paidCount: payouts.filter((p) => p.status === "paid").length,
      paidTotal: payouts.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0),
    };
  }, [payouts]);

  const filtered = useMemo(
    () =>
      payouts
        .filter((p) => statusFilter === "all" || p.status === statusFilter)
        .sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt)),
    [payouts, statusFilter]
  );

  if (!hydrated) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Marketplace"} /></p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Payout overview"} /></h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground"><LocalizedText text={"Creator payout requests. Approve or reject in this simulation — no real money can move. This portal deliberately does not edit payment credentials."} /></p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Clock3} label={translateUi("Requested balance")} value={moneyExact(stats.requested)} hint={`${payouts.filter((p) => p.status === "requested").length} awaiting decision`} />
        <StatCard icon={Check} label={translateUi("Approved (processing)")} value={moneyExact(stats.approved)} hint="clearing in preview days" />
        <StatCard icon={Wallet} label={translateUi("Paid out (all time)")} value={money(stats.paidTotal)} hint={`${stats.paidCount} payouts`} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Payout requests"} /></h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8.5 w-40 text-[12.5px]" aria-label={translateUi("Filter by status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all"><LocalizedText text={"All statuses"} /></SelectItem>
            <SelectItem value="requested"><LocalizedText text={"Requested"} /></SelectItem>
            <SelectItem value="approved"><LocalizedText text={"Approved"} /></SelectItem>
            <SelectItem value="paid"><LocalizedText text={"Paid"} /></SelectItem>
            <SelectItem value="rejected"><LocalizedText text={"Rejected"} /></SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={translateUi("No payouts in this state")}
          description={translateUi("When creators request payouts, they appear here for review (simulated).")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  <th className="py-3 pr-4 pl-5"><LocalizedText text={"Creator"} /></th>
                  <th className="px-4 py-3 text-right"><LocalizedText text={"Requested"} /></th>
                  <th className="px-4 py-3 text-right"><LocalizedText text={"Eligible balance"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Reference"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Requested"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Status"} /></th>
                  <th className="py-3 pr-5 pl-4 text-right"><LocalizedText text={"Decision"} /></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const ins = INSTRUCTORS.find((i) => i.id === p.creatorId);
                  const insufficient = p.amount > p.eligibleBalance;
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="max-w-48 py-3 pr-4 pl-5">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarFallback className={cn("text-[10px]", ins?.avatarColor ?? "bg-zinc-200 text-zinc-600")}>
                              <LocalizedText text={ins?.initials ?? "??"} />
                            </AvatarFallback>
                          </Avatar>
                          <p className="truncate text-[13px] font-semibold"><LocalizedText text={p.creatorName} /></p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums"><LocalizedText text={moneyExact(p.amount)} /></td>
                      <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">
                        <span className={cn(insufficient && "font-medium text-red-600")}>
                          <LocalizedText text={moneyExact(p.eligibleBalance)} />
                        </span>
                        {insufficient && (
                          <span title={translateUi("Requested amount exceeds eligible balance")}>
                            <CircleAlert className="ml-1 inline size-3.5 text-red-500" aria-label={translateUi("Exceeds balance")} />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-zinc-500"><LocalizedText text={p.reference} /></td>
                      <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted-foreground"><LocalizedText text={formatDate(p.requestedAt)} /></td>
                      <td className="px-4 py-3"><PayoutStatusBadge status={p.status} /></td>
                      <td className="py-3 pr-5 pl-4">
                        <div className="flex items-center justify-end gap-1">
                          {p.status === "requested" && (
                            <>
                              <ActionButton
                                label={translateUi("Approve")}
                                icon={Check}
                                size="sm"
                                confirmTitle={`Approve ${moneyExact(p.amount)} for ${p.creatorName}?`}
                                confirmBody="The request moves to “approved/processing” in this preview. No bank transfer is initiated."
                                confirmLabel="Approve payout"
                                onAction={() => setPayoutStatus(p.id, "approved")}
                                toastText="Payout approved (simulated)"
                              />
                              <ActionButton
                                label={translateUi("Reject")}
                                icon={Ban}
                                variant="outline"
                                danger
                                size="sm"
                                confirmTitle={`Reject ${moneyExact(p.amount)} for ${p.creatorName}?`}
                                confirmBody="The request is marked rejected in the mock state. The creator keeps their balance."
                                confirmLabel="Reject payout"
                                onAction={() => setPayoutStatus(p.id, "rejected")}
                                toastText="Payout rejected (simulated)"
                              />
                            </>
                          )}
                          {p.status === "approved" && (
                            <ActionButton
                              label={translateUi("Mark paid")}
                              icon={Check}
                              size="sm"
                              confirmTitle={`Mark ${moneyExact(p.amount)} as paid?`}
                              confirmBody="Bookkeeping only in this simulation — no real money moves."
                              confirmLabel="Mark as paid"
                              onAction={() => setPayoutStatus(p.id, "paid")}
                              toastText="Payout marked paid (simulated)"
                            />
                          )}
                          {(p.status === "paid" || p.status === "rejected") && (
                            <span className="text-[11.5px] text-zinc-400">
                              <LocalizedText text={p.processedAt ? `Resolved ${formatDate(p.processedAt)}` : "Resolved"} />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900/80">
        <span className="font-semibold"><LocalizedText text={"Simulation guardrail:"} /></span><LocalizedText text={"decisions here only relabel mock payouts. Creator payout credentials (from their own Settings) are redacted and never editable from the admin portal."} /></p>
    </div>
  );
}
