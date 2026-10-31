"use client";

import { format } from "date-fns";
import {
  AlertTriangle,
  BadgeCheck,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { ConnectLinkedInDialog } from "@/components/app/connect-linkedin-dialog";
import { SettingsNav } from "@/components/app/settings-nav";
import { LinkedinIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiDelete, apiPost, errorMessage } from "@/lib/api/client";
import { useLinkedInAccounts, useUsage } from "@/lib/app/hooks";
import type { LinkedInAccount } from "@/lib/app/types";

/**
 * LinkedIn connections.
 *
 * Lists what `/api/linkedin/accounts` returns — including the capability set the
 * app is actually approved for. Reconnect and disconnect are real calls; a
 * revoked or expired token is shown as such rather than as a working connection.
 */

const STATUS_TONE: Record<LinkedInAccount["status"], string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  expired: "bg-amber-50 text-amber-800 ring-amber-200",
  reauth_required: "bg-amber-50 text-amber-800 ring-amber-200",
  revoked: "bg-red-50 text-red-700 ring-red-200",
};

const STATUS_LABEL: Record<LinkedInAccount["status"], string> = {
  active: "Connected",
  expired: "Token expired",
  reauth_required: "Reconnect needed",
  revoked: "Disconnected",
};

export default function LinkedInSettingsPage() {
  const accounts = useLinkedInAccounts();
  const usage = useUsage();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] = useState<LinkedInAccount | null>(null);

  const connections = accounts.data?.connections ?? [];
  const capabilities = accounts.data?.capabilities ?? null;
  const accountLimit = usage.data?.accountLimit ?? 1;
  const atLimit = connections.filter((account) => account.status !== "revoked").length >= accountLimit;

  async function recheck(account: LinkedInAccount) {
    setBusyId(account.id);
    setError(null);
    try {
      await apiPost(`/api/linkedin/accounts/${account.id}`, {});
      accounts.reload();
    } catch (caught) {
      setError(errorMessage(caught, "Could not verify this connection."));
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(account: LinkedInAccount) {
    setBusyId(account.id);
    setError(null);
    try {
      await apiDelete(`/api/linkedin/accounts/${account.id}`);
      accounts.reload();
      usage.reload();
    } catch (caught) {
      setError(errorMessage(caught, "Could not disconnect this account."));
    } finally {
      setBusyId(null);
      setPendingDisconnect(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsNav />
      <div className="space-y-6">
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-[13px] text-red-800 ring-1 ring-red-200"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <section
          aria-labelledby="connections-heading"
          className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="connections-heading"
                className="flex items-center gap-2 text-[15px] font-semibold text-slate-900"
              >
                <LinkedinIcon className="size-4 text-brand-600" />
                Connected accounts
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {usage.loading
                  ? "Loading plan limits…"
                  : `This workspace allows ${accountLimit} account${accountLimit === 1 ? "" : "s"} on ${
                      usage.data?.plan === "pro" ? "Pro" : "Free"
                    }.`}
              </p>
            </div>
            <ConnectLinkedInDialog>
              <Button disabled={atLimit || accounts.loading}>
                <LinkedinIcon className="size-4" />
                Connect account
              </Button>
            </ConnectLinkedInDialog>
          </div>

          {atLimit && (
            <p className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] leading-6 text-slate-600 ring-1 ring-slate-200">
              You have reached the account limit for this plan.{" "}
              {usage.data?.plan === "pro"
                ? "Disconnect one before adding another."
                : "Pro allows up to 5 accounts per workspace."}
            </p>
          )}

          <div className="mt-6">
            {accounts.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : accounts.error ? (
              <p role="alert" className="text-[13px] text-red-600">
                {accounts.error}
              </p>
            ) : connections.length === 0 ? (
              <EmptyState
                compact
                icon={LinkedinIcon}
                title="No LinkedIn accounts connected"
                description="Connect an account to publish and, once the analytics scope is approved, to read post performance."
              />
            ) : (
              <ul className="space-y-3">
                {connections.map((account) => (
                  <li
                    key={account.id}
                    className="flex flex-wrap items-start gap-4 rounded-xl p-4 ring-1 ring-slate-200"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#0A66C2]/10 text-[#0A66C2]">
                      <LinkedinIcon className="size-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {account.displayName ?? "LinkedIn account"}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                            STATUS_TONE[account.status]
                          }`}
                        >
                          {STATUS_LABEL[account.status]}
                        </span>
                        {account.kind === "organization" && (
                          <Badge variant="neutral">Company page</Badge>
                        )}
                      </div>

                      <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                        {account.profileUrn}
                      </p>

                      <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
                        Scopes: {account.scopes.length > 0 ? account.scopes.join(", ") : "none"}
                      </p>
                      <p className="text-[12px] leading-5 text-slate-500">
                        {account.tokenExpiresAt
                          ? `Token expires ${format(new Date(account.tokenExpiresAt), "d MMM yyyy")}`
                          : "No token expiry reported by LinkedIn"}
                        {account.lastVerifiedAt
                          ? ` · verified ${format(new Date(account.lastVerifiedAt), "d MMM, HH:mm")}`
                          : ""}
                      </p>

                      {account.lastErrorMessage && (
                        <p className="mt-1.5 text-[12px] leading-5 text-red-600">
                          {account.lastErrorMessage}
                        </p>
                      )}

                      {!account.canReadAnalytics && (
                        <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
                          Analytics unavailable: this account was not granted{" "}
                          <code className="font-mono">r_member_postAnalytics</code>.
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busyId === account.id}
                        onClick={() => void recheck(account)}
                      >
                        {busyId === account.id ? (
                          <Loader2 className="animate-spin" aria-hidden />
                        ) : (
                          <RefreshCw aria-hidden />
                        )}
                        Recheck
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500"
                        disabled={busyId === account.id}
                        onClick={() => setPendingDisconnect(account)}
                      >
                        <Trash2 aria-hidden />
                        Disconnect
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Capability state */}
        <section aria-labelledby="caps-heading" className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
          <h2 id="caps-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <BadgeCheck className="size-4 text-brand-600" aria-hidden />
            What this deployment can do
          </h2>
          <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-[13px] text-slate-500">Publishing</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-800">
                {capabilities?.publishing ? "Enabled (w_member_social)" : "Not configured"}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-slate-500">Post analytics</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-800">
                {capabilities?.analytics ? "Enabled" : "Awaiting Community Management access"}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-slate-500">LinkedIn API version</dt>
              <dd className="mt-0.5 font-mono text-sm font-medium text-slate-800">
                {capabilities?.apiVersion ?? "—"}
              </dd>
            </div>
          </dl>
          <ul className="mt-5 space-y-4 border-t border-slate-200 pt-5">
            {[
              {
                icon: ShieldCheck,
                title: "Official OAuth, minimal scopes",
                copy: "Authorisation happens on linkedin.com. Zybble requests only the scopes it is approved for, stores the token encrypted with AES-256-GCM, and never decrypts it in the browser.",
              },
              {
                icon: RefreshCw,
                title: "Health monitoring",
                copy: "A scheduled job checks every connection daily. Expired tokens raise a notification and a reconnect prompt — a dead token never silently eats your queue.",
              },
              {
                icon: Trash2,
                title: "Clean disconnects",
                copy: "Disconnecting deletes the stored credential immediately. Published posts stay on LinkedIn; scheduled posts for that account are reported as blocked rather than deleted.",
              },
            ].map((cap) => (
              <li key={cap.title} className="flex gap-3.5">
                <cap.icon className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-slate-800">{cap.title}</p>
                  <p className="mt-0.5 text-[13px] leading-6 text-slate-600">{cap.copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Organisation pages */}
        <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Company pages</h3>
              <p className="mt-1 max-w-md text-[13px] leading-6 text-slate-500">
                Organisation publishing needs the{" "}
                <code className="font-mono text-[12px]">w_organization_social</code> scope plus
                Marketing API approval and a page admin role. Zybble does not request it until that
                access is granted.
              </p>
            </div>
            <Button variant="secondary" disabled>
              Connect company page
            </Button>
          </div>
        </section>
      </div>

      {/* Disconnect confirmation */}
      <Dialog
        open={pendingDisconnect !== null}
        onOpenChange={(open) => !open && setPendingDisconnect(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect this account?</DialogTitle>
            <DialogDescription>
              The stored access token is deleted immediately. Posts already published stay on
              LinkedIn; scheduled posts for{" "}
              {pendingDisconnect?.displayName ?? "this account"} stay in your calendar and will be
              reported as blocked until you reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" asChild>
              <DialogClose>Cancel</DialogClose>
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
              disabled={busyId !== null}
              onClick={() => pendingDisconnect && void disconnect(pendingDisconnect)}
            >
              {busyId !== null && <Loader2 className="animate-spin" aria-hidden />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
