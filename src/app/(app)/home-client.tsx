"use client";

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Compass,
  PlayCircle,
  Rocket,
  Sparkles,
} from "lucide-react";
import type { Course } from "@/types";
import { CATEGORIES, COURSES } from "@/data/mock-data";
import { marketplaceStats, sortCourses } from "@/lib/courses";
import { formatCompact } from "@/lib/format";
import { categoryIcon } from "@/lib/icons";
import { progressOf, resolveCourse } from "@/lib/learn";
import { useApp } from "@/components/providers/app-providers";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import { SearchBox } from "@/components/layout/search-box";
import { CourseCarousel } from "@/components/courses/course-carousel";
import { SectionHeader } from "@/components/courses/section-header";
import { Button } from "@/components/ui/button";

/* ---------------------------------- hero ---------------------------------- */

function Hero({ stats }: { stats: ReturnType<typeof marketplaceStats> }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-violet-200/70 bg-accent">
      <div
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-violet-300/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-fuchsia-200/40 blur-3xl"
        aria-hidden
      />
      <div className="relative px-5 py-9 sm:px-8 sm:py-12 lg:px-10 lg:py-14">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-[11.5px] font-semibold tracking-wide text-accent-foreground uppercase">
          <Sparkles className="size-3.5" aria-hidden />
          Practical AI courses
        </span>
        <h1 className="font-display mt-4 max-w-2xl text-[30px] leading-[1.1] font-bold tracking-tight text-violet-950 sm:text-[40px] lg:text-[46px]">
          Learn AI skills that ship.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-violet-950/65">
          Project-based courses from people who build for a living. Learn a tool this weekend,
          master a discipline over months — and finish with a certificate that proves it.
        </p>

        <div className="mt-6 max-w-xl">
          <SearchBox className="w-full" />
        </div>

        <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {[
            { label: "Learners", value: formatCompact(stats.students) },
            { label: "Courses", value: String(stats.courses) },
            { label: "Instructors", value: String(stats.instructors) },
            { label: "Lessons", value: formatCompact(stats.lessons) },
          ].map((s) => (
            <div key={s.label}>
              <dt className="text-[11px] font-semibold tracking-[0.08em] text-violet-950/50 uppercase">
                {s.label}
              </dt>
              <dd className="font-display mt-0.5 text-[22px] font-bold tracking-tight text-violet-950">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ----------------------------- continue learning --------------------------- */

function ContinueCard({ course, percent, resumeHref }: { course: Course; percent: number; resumeHref: string }) {
  return (
    <li className="w-[268px] shrink-0 snap-start sm:w-[320px]">
      <Link
        href={resumeHref}
        className="group flex h-full gap-3 rounded-xl border border-border bg-white p-3 shadow-card transition-all hover:border-violet-200 hover:shadow-card-hover"
      >
        <span className="relative block aspect-video w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          <Image
            src={course.thumbnail}
            alt=""
            fill
            sizes="96px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 text-[13px] font-semibold leading-snug">
            {course.title}
          </span>
          <span className="mt-auto pt-2">
            <span className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>{percent === 100 ? "Completed" : `${percent}% complete`}</span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <span
                className="block h-full rounded-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

function ContinueLearning({
  items,
}: {
  items: { course: Course; percent: number; resumeHref: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeader
        title="Pick up where you left off"
        description="Your enrolled courses, with progress saved on this device"
        viewAllHref="/dashboard"
      />
      <ul className="-mr-4 flex snap-x gap-3 overflow-x-auto overscroll-contain-x pr-4 pb-2 scrollbar-hide sm:-mr-6 sm:pr-6 lg:-mr-10 lg:pr-10">
        {items.map((item) => (
          <ContinueCard key={item.course.id} {...item} />
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------- certificates ------------------------------ */

function CertificatesStrip() {
  const { certificates } = useApp();
  if (certificates.length === 0) return null;

  return (
    <section className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <Award className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[16px] font-semibold tracking-tight">
            {certificates.length === 1
              ? "You've earned 1 certificate"
              : `You've earned ${certificates.length} certificates`}
          </h2>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {certificates[certificates.length - 1].courseTitle}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/certificates">
            View certificates
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/* -------------------------------- categories ------------------------------- */

function CategoryGrid() {
  return (
    <section>
      <SectionHeader
        title="Browse by category"
        description="Eight tracks, from automation to productivity"
        viewAllHref="/explore"
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.map((category) => {
          const Icon = categoryIcon(category.icon);
          return (
            <li key={category.slug}>
              <Link
                href={`/categories/${category.slug}`}
                className="group flex h-full items-start gap-3 rounded-xl border border-border bg-white p-3.5 shadow-card transition-all hover:border-violet-200 hover:shadow-card-hover"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold">{category.name}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[12px] leading-relaxed text-muted-foreground">
                    {category.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* --------------------------------- how it --------------------------------- */

function HowItWorks() {
  const steps = [
    {
      icon: Compass,
      title: "Find a course",
      text: "Browse eight categories, filter by level, price and duration, and preview free lessons before you commit.",
    },
    {
      icon: PlayCircle,
      title: "Learn by building",
      text: "Follow project-based lessons at your own pace. Take notes, download resources and track every lesson you finish.",
    },
    {
      icon: BadgeCheck,
      title: "Earn your certificate",
      text: "Complete the last lesson and Zybble issues a personalised certificate you can download and share.",
    },
  ];
  return (
    <section className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7">
      <SectionHeader
        title="How Zybble works"
        description="Three steps from curious to certified"
      />
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white">
                <step.icon className="size-4.5" aria-hidden />
              </span>
              <span className="font-display text-[12px] font-bold tracking-[0.1em] text-zinc-400 uppercase">
                Step {i + 1}
              </span>
            </div>
            <h3 className="mt-3 text-[14px] font-semibold">{step.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ----------------------------------- CTA ---------------------------------- */

function InstructorCta() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8">
      <div
        className="pointer-events-none absolute -top-20 -right-10 size-56 rounded-full bg-violet-200/30 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <Rocket className="size-5.5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Teach what you know
            </h2>
            <p className="mt-1 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
              Publish a course from the creator studio — curriculum editor, pricing, analytics and
              payouts are all here in the demo.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/creator">
            Open creator studio
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function HomeClient() {
  const { hydrated, enrollments } = useApp();
  const community = useCommunityCourses();
  const stats = useMemo(() => marketplaceStats(), []);

  // Static catalog + courses published locally from the creator studio.
  const pool = useMemo(() => [...community, ...COURSES], [community]);
  const featured = useMemo(() => sortCourses(pool, "popular").slice(0, 8), [pool]);
  const topRated = useMemo(() => sortCourses(pool, "rating").slice(0, 8), [pool]);
  const newest = useMemo(() => sortCourses(pool, "newest").slice(0, 8), [pool]);

  const continueItems = useMemo(() => {
    if (!hydrated) return [];
    return enrollments
      .map((enrollment) => {
        const course = resolveCourse(enrollment.courseId, community);
        if (!course) return null;
        const progress = progressOf(course, enrollment);
        if (progress.isCompleted) return null;
        const resume = progress.resumeLesson;
        return {
          course,
          percent: progress.percent,
          resumeHref: `/learn/${course.id}${resume ? `?lesson=${resume.lesson.id}` : ""}`,
        };
      })
      .filter((x): x is { course: Course; percent: number; resumeHref: string } => x !== null)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 8);
  }, [hydrated, enrollments, community]);

  return (
    <div className="page-container py-7 sm:py-9">
      <Hero stats={stats} />

      <div className="mt-10 space-y-12">
        <ContinueLearning items={continueItems} />
        <CertificatesStrip />

        <CourseCarousel
          title="Featured courses"
          description="What learners are starting right now"
          courses={featured}
        />
        <CategoryGrid />
        <CourseCarousel
          title="Top rated"
          description="Highest learner satisfaction on Zybble"
          courses={topRated}
        />
        <CourseCarousel
          title="New on Zybble"
          description="Fresh from our instructor community"
          courses={newest}
        />
        <HowItWorks />
        <InstructorCta />
      </div>
    </div>
  );
}
