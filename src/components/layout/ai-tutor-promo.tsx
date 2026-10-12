"use client";

import Link from "next/link";
import { ArrowRight, Bot, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Compact promo panel docked at the bottom of the sidebar. */
export function AiTutorMiniPanel() {
  return (
    <div className="mx-0.5 mb-4 rounded-xl border border-violet-200/80 bg-accent p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
          <Bot className="size-4" aria-hidden />
        </span>
        <p className="text-[13px] font-semibold text-accent-foreground">Zybble AI Tutor</p>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-violet-900/70">
        Stuck on a lesson? Ask and get step-by-step help, 24/7.
      </p>
      <Button asChild size="sm" variant="outline" className="mt-3 w-full border-violet-200 bg-white text-accent-foreground hover:bg-violet-50">
        <Link href="/help#ai-tutor">
          How it works
          <ArrowRight className="ml-0.5" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

/** Premium horizontal banner shown on the Explore page. */
export function AiTutorBanner() {
  return (
    <section className="relative overflow-hidden rounded-xl border border-violet-200/70 bg-accent">
      <div
        className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-violet-300/25 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 right-40 size-44 rounded-full bg-fuchsia-200/30 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-violet-600/20">
            <Bot className="size-5.5" aria-hidden />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
                Meet your AI Tutor
              </h2>
              <span className="rounded-md border border-violet-300/70 bg-white/70 px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-accent-foreground uppercase">
                Included
              </span>
            </div>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-violet-950/60">
              Every eligible course includes a personal AI tutor that knows the curriculum.
              Ask questions, get unstuck, and practice — without leaving the lesson.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-15 sm:pl-0">
          <Button asChild variant="outline" className="border-violet-200 bg-white/80 text-accent-foreground hover:bg-white">
            <Link href="/courses/prompt-engineering-foundations">
              <MessageCircleQuestion aria-hidden />
              Try it free
            </Link>
          </Button>
          <Button asChild className="shadow-md shadow-violet-600/20">
            <Link href="/help#ai-tutor">
              <Sparkles aria-hidden />
              Learn more
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
