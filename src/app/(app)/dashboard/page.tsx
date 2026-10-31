"use client";

import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Eye,
  PenSquare,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { StatCard } from "@/components/app/stat-card";
import { ConnectLinkedInDialog } from "@/components/app/connect-linkedin-dialog";
import { TrendChart } from "@/components/charts/trend-chart";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { LinkedinIcon } from "@/components/icons";
import { useClientMounted, useLocalPosts } from "@/lib/app/hooks";

export default function DashboardPage() {
  const posts = useLocalPosts();
  const mounted = useClientMounted();
  const scheduled = posts.filter((p) => p.status === "scheduled");
  const drafts = posts.filter((p) => p.status === "draft");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* State: no LinkedIn account connected (true for every visitor until Prompt 3) */}
      <section
        aria-labelledby="connect-heading"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-8 text-white sm:p-10"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.07)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_80%_at_70%_20%,black,transparent)]"
        />
        <div className="relative max-w-xl">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <LinkedinIcon className="size-5" />
          </span>
          <h2 id="connect-heading" className="mt-5 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Connect LinkedIn to wake this dashboard up
          </h2>
          <p className="mt-3 text-pretty text-[15px] leading-7 text-brand-100">
            Publishing, real analytics and best-time insights all start the
            moment your LinkedIn account is linked. Until then, you can explore
            freely — drafts and schedules you create stay on this device as a
            local preview.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ConnectLinkedInDialog>
              <Button variant="inverse" size="lg">
                <LinkedinIcon className="size-4" />
                Connect LinkedIn
              </Button>
            </ConnectLinkedInDialog>
            <Button variant="outline-inverse" size="lg" asChild>
              <Link href="/posts/new">
                <PenSquare aria-hidden />
                Draft a post locally
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Publishing overview — zeros derived from the local store are real; remote metrics stay "—" */}
      <section aria-label="Publishing overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Scheduled"
          value={mounted ? String(scheduled.length) : null}
          icon={CalendarClock}
          hint="local preview — syncs when your account connects"
        />
        <StatCard
          label="Published (7 days)"
          value={null}
          icon={Send}
          hint="available after connecting LinkedIn"
        />
        <StatCard
          label="Impressions (7 days)"
          value={null}
          icon={Eye}
          hint="reported by the LinkedIn API — no estimates"
          delta={null}
        />
        <StatCard
          label="Engagement trend"
          value={null}
          icon={TrendingUp}
          hint="computed from your published posts"
          delta={null}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming content */}
        <section aria-labelledby="upcoming-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 id="upcoming-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <CalendarClock className="size-4 text-brand-600" aria-hidden />
              Upcoming content
            </h2>
            {scheduled.length > 0 && <Badge variant="neutral">Local preview</Badge>}
          </div>
          {!mounted ? (
            <div className="mt-5 space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : scheduled.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                compact
                icon={CalendarDays}
                title="Nothing scheduled yet"
                description="Your queue and calendar fill in as you schedule posts. Draft something now — it stays on this device."
              >
                <Button asChild size="sm">
                  <Link href="/posts/new">New post</Link>
                </Button>
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-5 space-y-2.5">
              {scheduled.slice(0, 4).map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/posts/${post.id}/edit`}
                    className="flex items-start gap-3 rounded-xl p-3 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <PenSquare className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {post.text || "Untitled post"}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-slate-500">
                        {post.scheduledAt
                          ? format(new Date(post.scheduledAt), "EEEE d MMM · HH:mm")
                          : "Unscheduled"}
                        {post.timezone ? ` · ${post.timezone}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {scheduled.length > 0 && (
            <Link
              href="/calendar"
              className="mt-4 inline-block text-[13px] font-medium text-brand-700 hover:text-brand-800"
            >
              Open calendar →
            </Link>
          )}
        </section>

        {/* Recent performance */}
        <section aria-labelledby="performance-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <h2 id="performance-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <BarChart3 className="size-4 text-brand-600" aria-hidden />
            Recent performance
          </h2>
          <div className="mt-5">
            <TrendChart
              data={[]}
              series={[{ key: "impressions", label: "Impressions", color: "#2563eb" }]}
              status="empty"
              yAxisLabel="Impressions per day"
              emptyTitle="No published posts to measure"
              emptyDescription="Once scheduled posts go live through your connected account, their daily impressions chart here."
            />
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Best posting times — Pro */}
        <section aria-labelledby="besttime-heading" className="relative overflow-hidden rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 id="besttime-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <Sparkles className="size-4 text-brand-600" aria-hidden />
              Best posting times
            </h2>
            <Badge>Pro</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            A heatmap of when your audience historically engages — computed from
            your published posts, never from generic averages.
          </p>
          <div
            aria-hidden
            className="pointer-events-none mt-5 grid grid-cols-[2.5rem_repeat(8,1fr)] gap-1 opacity-60 blur-[1.5px]"
          >
            <span />
            {["6", "8", "10", "12", "14", "16", "18", "20"].map((h) => (
              <span key={h} className="text-center text-[10px] text-slate-400">{h}:00</span>
            ))}
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d} className="contents">
                <span className="text-[10px] text-slate-400">{d}</span>
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="h-6 rounded-[5px] bg-slate-100" />
                ))}
              </span>
            ))}
          </div>
          <div className="absolute inset-x-6 bottom-6 top-[92px] flex flex-col items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
            <p className="text-sm font-medium text-slate-700">Unlocks with Pro</p>
            <p className="mt-1 max-w-[240px] text-center text-[13px] leading-5 text-slate-500">
              …and real data. Both arrive together — connect LinkedIn, publish
              for a while, then read your heatmap.
            </p>
            <Button asChild size="sm" variant="secondary" className="mt-4">
              <Link href="/settings/billing">See Pro</Link>
            </Button>
          </div>
        </section>

        {/* Quick actions */}
        <section aria-labelledby="quick-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <h2 id="quick-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <PenSquare className="size-4 text-brand-600" aria-hidden />
            Quick actions
          </h2>
          <ul className="mt-4 space-y-2.5">
            {[
              { href: "/posts/new", icon: PenSquare, title: "Write a post", copy: "Draft or schedule — saved locally until sync ships." },
              { href: "/calendar", icon: CalendarDays, title: "Open the calendar", copy: "See the week and month at a glance." },
              { href: "/settings/linkedin", icon: LinkedinIcon, title: "Manage LinkedIn accounts", copy: "Connect, check status, set the default voice." },
            ].map((action) => (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="flex items-start gap-3.5 rounded-xl p-3.5 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <action.icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{action.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-slate-500">{action.copy}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {mounted && drafts.length > 0 && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-600 ring-1 ring-slate-100">
              You have {drafts.length} local {drafts.length === 1 ? "draft" : "drafts"} waiting —{" "}
              <Link href="/posts" className="font-medium text-brand-700 hover:text-brand-800">
                review them
              </Link>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
