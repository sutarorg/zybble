"use client";

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
  if (status === "requested") return <Badge variant="amber">Requested</Badge>;
  if (status === "approved") return <Badge variant="sky">Approved</Badge>;
  if (status === "paid") return <Badge variant="emerald">Paid</Badge>;
  return <Badge className="border-red-200 bg-red-50 text-red-600">Rejected</Badge>;
}

export default function AdminPayoutsPage() {
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
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Marketplace</p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">Payout overview</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground">
          Creator payout requests. Approve or reject in this simulation — no real money can move.
          This portal deliberately does not edit payment credentials.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Clock3} label="Requested balance" value={moneyExact(stats.requested)} hint={`${payouts.filter((p) => p.status === "requested").length} awaiting decision`} />
        <StatCard icon={Check} label="Approved (processing)" value={moneyExact(stats.approved)} hint="clearing in demo days" />
        <StatCard icon={Wallet} label="Paid out (all time)" value={money(stats.paidTotal)} hint={`${stats.paidCount} payouts`} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-[15.5px] font-semibold">Payout requests</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8.5 w-40 text-[12.5px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No payouts in this state"
          description="When creators request payouts, they appear here for review (simulated)."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  <th className="py-3 pr-4 pl-5">Creator</th>
                  <th className="px-4 py-3 text-right">Requested</th>
                  <th className="px-4 py-3 text-right">Eligible balance</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="py-3 pr-5 pl-4 text-right">Decision</th>
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
                              {ins?.initials ?? "??"}
                            </AvatarFallback>
                          </Avatar>
                          <p className="truncate text-[13px] font-semibold">{p.creatorName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">{moneyExact(p.amount)}</td>
                      <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">
                        <span className={cn(insufficient && "font-medium text-red-600")}>
                          {moneyExact(p.eligibleBalance)}
                        </span>
                        {insufficient && (
                          <span title="Requested amount exceeds eligible balance">
                            <CircleAlert className="ml-1 inline size-3.5 text-red-500" aria-label="Exceeds balance" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-zinc-500">{p.reference}</td>
                      <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted-foreground">{formatDate(p.requestedAt)}</td>
                      <td className="px-4 py-3"><PayoutStatusBadge status={p.status} /></td>
                      <td className="py-3 pr-5 pl-4">
                        <div className="flex items-center justify-end gap-1">
                          {p.status === "requested" && (
                            <>
                              <ActionButton
                                label="Approve"
                                icon={Check}
                                size="sm"
                                confirmTitle={`Approve ${moneyExact(p.amount)} for ${p.creatorName}?`}
                                confirmBody="The request moves to “approved/processing” in this demo. No bank transfer is initiated."
                                confirmLabel="Approve payout"
                                onAction={() => setPayoutStatus(p.id, "approved")}
                                toastText="Payout approved (simulated)"
                              />
                              <ActionButton
                                label="Reject"
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
                              label="Mark paid"
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
                              {p.processedAt ? `Resolved ${formatDate(p.processedAt)}` : "Resolved"}
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
        <span className="font-semibold">Simulation guardrail:</span> decisions here only relabel mock
        payouts. Creator payout credentials (from their own Settings) are redacted and never editable
        from the admin portal.
      </p>
    </div>
  );
}
