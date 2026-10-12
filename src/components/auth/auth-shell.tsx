import * as React from "react";
import Link from "next/link";
import { Bot, GraduationCap, Star, Users } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { RatingStars } from "@/components/ui/rating-stars";

/**
 * Split-screen shell for /login and /signup:
 * form on the left, brand proof panel on the right.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form column */}
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/explore"
            className="rounded-lg px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Skip to Explore
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="font-display text-[26px] font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-6 text-center text-[13.5px] text-muted-foreground">{footer}</div>
          </div>
        </div>
        <p className="text-center text-[11.5px] text-zinc-400">
          Frontend demo — authentication is simulated and stored only in your browser.
        </p>
      </div>

      {/* Brand panel */}
      <div className="relative hidden overflow-hidden border-l border-violet-200/70 bg-accent lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-violet-300/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-fuchsia-200/40 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-md">
          <p className="text-[11px] font-bold tracking-[0.16em] text-accent-foreground uppercase">
            Zybble
          </p>
          <h2 className="font-display mt-3 text-[30px] leading-tight font-bold tracking-tight text-violet-950">
            The fastest way to become dangerous with AI.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-violet-950/60">
            Join 320,000+ learners building real skills with practitioners — not watching talking
            heads.
          </p>

          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3.5 rounded-xl border border-violet-200/70 bg-white/80 p-4 shadow-card backdrop-blur">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="size-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold">Project-based, always</p>
                <p className="text-[12.5px] text-muted-foreground">
                  Ship something real in every single course.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3.5 rounded-xl border border-violet-200/70 bg-white/80 p-4 shadow-card backdrop-blur">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="size-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold">AI Tutor included</p>
                <p className="text-[12.5px] text-muted-foreground">
                  Stuck at 2am? Get unstuck in seconds.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3.5 rounded-xl border border-violet-200/70 bg-white/80 p-4 shadow-card backdrop-blur">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-4.5" aria-hidden />
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold">Loved by learners</p>
                  <RatingStars rating={4.8} />
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <Star className="size-3 fill-star text-star" aria-hidden />
                  4.8 average across 22,000+ course ratings
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
