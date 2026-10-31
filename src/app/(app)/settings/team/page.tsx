"use client";

import { format } from "date-fns";
import { AlertTriangle, Loader2, Mail, Sparkles, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SettingsNav } from "@/components/app/settings-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiDelete, apiPatch, apiPost, errorMessage } from "@/lib/api/client";
import { useMembers, useUsage } from "@/lib/app/hooks";
import type { TeamMember, TeamRole } from "@/lib/app/types";

/**
 * Team management.
 *
 * The roster comes from `/api/workspaces/current/members`; invitations, role
 * changes and removals go back through the same route family. Seat billing is
 * derived from *active* members only, and the seat-sync job recomputes it after
 * every membership change — pending invitations are never billed.
 */

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_COPY: Record<TeamRole, string> = {
  owner: "Full access, including billing and deletion",
  admin: "Manage members, LinkedIn accounts and billing",
  editor: "Draft, schedule and publish posts",
  viewer: "Read-only access to the calendar and analytics",
};

export default function TeamSettingsPage() {
  const roster = useMembers();
  const usage = useUsage();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<TeamRole, "owner">>("editor");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const members = roster.data?.members ?? [];
  const canManage = roster.data?.role === "owner" || roster.data?.role === "admin";
  const isPro = usage.data?.plan === "pro";
  const activeSeats = members.filter((member) => member.status === "active").length;

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy("invite");
    setError(null);
    setNotice(null);

    try {
      const result = await apiPost<{ member: TeamMember; emailQueued: boolean }>(
        "/api/workspaces/current/members",
        { email, role },
      );
      setNotice(
        result.emailQueued
          ? `Invitation sent to ${result.member.email}. It expires in 7 days.`
          : `Invitation created for ${result.member.email}, but the invite email could not be queued — check the Resend configuration.`,
      );
      setEmail("");
      roster.reload();
    } catch (caught) {
      setError(errorMessage(caught, "Could not send the invitation."));
    } finally {
      setBusy(null);
    }
  }

  async function changeRole(member: TeamMember, next: Exclude<TeamRole, "owner">) {
    setBusy(member.id);
    setError(null);
    try {
      await apiPatch(`/api/workspaces/current/members/${member.id}`, { role: next });
      roster.reload();
    } catch (caught) {
      setError(errorMessage(caught, "Could not change this role."));
    } finally {
      setBusy(null);
    }
  }

  async function remove(member: TeamMember) {
    setBusy(member.id);
    setError(null);
    try {
      await apiDelete(`/api/workspaces/current/members/${member.id}`);
      roster.reload();
      usage.reload();
    } catch (caught) {
      setError(errorMessage(caught, "Could not remove this member."));
    } finally {
      setBusy(null);
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
        {notice && (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900 ring-1 ring-emerald-200">
            {notice}
          </p>
        )}

        {/* Current members */}
        <section
          aria-labelledby="members-heading"
          className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="members-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <Users className="size-4 text-brand-600" aria-hidden />
              Members
            </h2>
            <Badge variant="neutral">
              {roster.loading ? "…" : `${activeSeats} active seat${activeSeats === 1 ? "" : "s"}`}
            </Badge>
          </div>

          {roster.loading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : roster.error ? (
            <p role="alert" className="mt-4 text-[13px] text-red-600">
              {roster.error}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {members.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-3.5 py-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-500">
                    {(member.name ?? member.email).trim().slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {member.name ?? member.email}
                    </p>
                    <p className="truncate text-[13px] text-slate-500">
                      {member.name ? `${member.email} · ` : ""}
                      {member.status === "invited"
                        ? `Invited ${
                            member.inviteExpiresAt
                              ? `· expires ${format(new Date(member.inviteExpiresAt), "d MMM")}`
                              : ""
                          }`
                        : ROLE_COPY[member.role]}
                    </p>
                  </div>

                  {member.role === "owner" || !canManage ? (
                    <Badge variant="neutral">{ROLE_LABEL[member.role]}</Badge>
                  ) : (
                    <Select
                      value={member.role}
                      disabled={busy === member.id}
                      onValueChange={(next) =>
                        void changeRole(member, next as Exclude<TeamRole, "owner">)
                      }
                    >
                      <SelectTrigger className="w-32" aria-label={`Role for ${member.email}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["admin", "editor", "viewer"] as const).map((option) => (
                          <SelectItem key={option} value={option}>
                            {ROLE_LABEL[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {member.role !== "owner" && canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-500"
                      disabled={busy === member.id}
                      onClick={() => void remove(member)}
                      aria-label={`Remove ${member.email}`}
                    >
                      {busy === member.id ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : (
                        <Trash2 aria-hidden />
                      )}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] leading-5 text-slate-500 ring-1 ring-slate-100">
            One seat = one active member, billed at $15 per seat per month
            {isPro ? "" : " on Pro"}. Pending invitations are not billed; removing a member reduces
            the seat count at the next sync.
          </p>
        </section>

        {/* Invite */}
        <section
          aria-labelledby="invite-heading"
          className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <h2 id="invite-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <Mail className="size-4 text-brand-600" aria-hidden />
              Invite teammates
            </h2>
            <Badge>Pro</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Invited editors can draft and schedule for every LinkedIn account in the workspace.
            Admins also manage members, connections and billing.
          </p>

          {!isPro ? (
            <p className="mt-5 rounded-xl bg-slate-50 px-3.5 py-3 text-[13px] leading-6 text-slate-600 ring-1 ring-slate-200">
              Team collaboration is a Pro feature. On the Free plan the workspace is single-seat —
              upgrade to invite others.
            </p>
          ) : !canManage ? (
            <p className="mt-5 rounded-xl bg-slate-50 px-3.5 py-3 text-[13px] leading-6 text-slate-600 ring-1 ring-slate-200">
              Only owners and admins can invite members.
            </p>
          ) : (
            <form className="mt-5 flex flex-wrap gap-2" onSubmit={(event) => void invite(event)}>
              <div className="min-w-56 flex-1">
                <Label htmlFor="invite-email" className="sr-only">
                  Email to invite
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <Select value={role} onValueChange={(next) => setRole(next as typeof role)}>
                <SelectTrigger className="w-32" aria-label="Invite role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["admin", "editor", "viewer"] as const).map((option) => (
                    <SelectItem key={option} value={option}>
                      {ROLE_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={busy === "invite" || email.trim().length === 0}>
                {busy === "invite" && <Loader2 className="animate-spin" aria-hidden />}
                Send invite
              </Button>
            </form>
          )}
        </section>

        {/* Upgrade call */}
        {!isPro && (
          <section className="rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-7 text-white">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Sparkles className="size-5" aria-hidden />
              Collaboration is a Pro superpower
            </h2>
            <p className="mt-2 max-w-lg text-[15px] leading-7 text-brand-100">
              Founders, ghostwriters and consultants in one workspace — shared calendars, shared
              accounts, separate seats at $15 each.
            </p>
            <Button asChild variant="inverse" className="mt-5">
              <Link href="/settings/billing">See Pro plan</Link>
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
