"use client";

import { Mail, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { SettingsNav } from "@/components/app/settings-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";

export default function TeamSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <SettingsNav />
      <div className="space-y-6">
        {/* Current members */}
        <section aria-labelledby="members-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <h2 id="members-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <Users className="size-4 text-brand-600" aria-hidden />
            Members
          </h2>
          <ul className="mt-4 divide-y divide-slate-100">
            <li className="flex items-center gap-3.5 py-3.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-500">
                Y
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">You</p>
                <p className="text-[13px] text-slate-500">Workspace owner · full access</p>
              </div>
              <Badge variant="neutral">Owner</Badge>
            </li>
          </ul>
          <p className="mt-3 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] leading-5 text-slate-500 ring-1 ring-slate-100">
            Seats on Pro are billed at $15 each per month and can be reassigned
            at any time.
          </p>
        </section>

        {/* Invite — Pro-gated with honest explanation */}
        <section aria-labelledby="invite-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 id="invite-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <Mail className="size-4 text-brand-600" aria-hidden />
              Invite teammates
            </h2>
            <Badge>Pro</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Invited editors can draft and schedule for every LinkedIn account in
            the workspace. Owners manage billing and connections.
          </p>
          <form className="mt-5 flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <div className="flex-1">
              <Label htmlFor="invite-email" className="sr-only">
                Email to invite
              </Label>
              <Tooltip content="Invites are a Pro capability — upgrade when billing opens.">
                <Input id="invite-email" type="email" placeholder="teammate@company.com" disabled />
              </Tooltip>
            </div>
            <Tooltip content="Invites are a Pro capability — upgrade when billing opens.">
              <span>
                <Button disabled>Send invite</Button>
              </span>
            </Tooltip>
          </form>
        </section>

        {/* Upgrade call */}
        <section className="rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-7 text-white">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles className="size-5" aria-hidden />
            Collaboration is a Pro superpower
          </h2>
          <p className="mt-2 max-w-lg text-[15px] leading-7 text-brand-100">
            Founders, ghostwriters and consultants in one workspace — shared
            calendars, shared accounts, separate seats at $15 each.
          </p>
          <Button asChild variant="inverse" className="mt-5">
            <Link href="/settings/billing">See Pro plan</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
