"use client";

import { BadgeCheck, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import Image from "next/image";
import { ConnectLinkedInDialog } from "@/components/app/connect-linkedin-dialog";
import { SettingsNav } from "@/components/app/settings-nav";
import { LinkedinIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";

const plannedCapabilities = [
  {
    icon: ShieldCheck,
    title: "Official OAuth, minimal scopes",
    copy: "Authorisation happens on linkedin.com with publishing (w_member_social) and profile-read scopes only. Tokens in Zybble are encrypted at rest and revocable from either side.",
  },
  {
    icon: RefreshCw,
    title: "Health monitoring",
    copy: "Expired tokens surface here the moment they happen, with a one-click reconnect — so a dead token never silently eats your queue.",
  },
  {
    icon: Trash2,
    title: "Clean disconnects",
    copy: "Removing an account deletes its tokens and stops its queue. Your published posts stay on LinkedIn; analytics history stays readable.",
  },
] as const;

export default function LinkedInSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <SettingsNav />
      <div className="space-y-6">
        <section aria-labelledby="connections-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="connections-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <LinkedinIcon className="size-4 text-brand-600" />
                Connected accounts
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Free plan: 1 account · Pro: up to 5 per workspace.
              </p>
            </div>
            <ConnectLinkedInDialog>
              <Button>
                <LinkedinIcon className="size-4" />
                Connect account
              </Button>
            </ConnectLinkedInDialog>
          </div>

          <div className="mt-6">
            <EmptyState
              compact
              icon={LinkedinIcon}
              title="No LinkedIn accounts connected"
              description="Profiles and company pages you connect appear here with their status, scopes and a one-click reconnect."
            />
          </div>
        </section>

        {/* What connecting unlocks */}
        <section aria-labelledby="caps-heading" className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
          <h2 id="caps-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <BadgeCheck className="size-4 text-brand-600" aria-hidden />
            What a connection gives Zybble
          </h2>
          <ul className="mt-4 space-y-4">
            {plannedCapabilities.map((cap) => (
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
                Publishing to organisation pages requires the LinkedIn Marketing
                API tier. It&rsquo;s planned once app review clears — the
                interface is ready.
              </p>
            </div>
            <Tooltip content="LinkedIn organisation publishing requires Marketing API approval — pending review.">
              <span>
                <Button variant="secondary" disabled>
                  Connect company page
                </Button>
              </span>
            </Tooltip>
          </div>
        </section>
      </div>
    </div>
  );
}
