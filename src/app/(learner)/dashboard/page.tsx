"use client";

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  ListChecks,
  Lock,
  Medal,
  Play,
  Rocket,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import type { Course, Enrollment } from "@/types";
import { COURSES } from "@/data/mock-data";
import { useApp } from "@/components/providers/app-providers";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import {
  learnerTotals,
  instructorOf,
  progressOf,
  recommendedCourses,
  resolveCourse,
} from "@/lib/learn";
import { timeAgo } from "@/lib/format";
import { CourseCard } from "@/components/courses/course-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/creator/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/* ------------------------------ achievements ------------------------------- */

function useAchievements(
  pairs: { course: Course; enrollment: Enrollment }[],
  recentCount: number,
  lessonsTotal: number
) {
  return useMemo(() => {
    const anyHalf = pairs.some(({ course, enrollment }) => progressOf(course, enrollment).percent >= 50);
    const anyDone = pairs.some(({ course, enrollment }) => progressOf(course, enrollment).isCompleted);
    return [
      { id: "first-enroll", icon: Rocket, label: "First enrollment", earned: pairs.length > 0 },
      { id: "first-lesson", icon: Zap, label: "First lesson done", earned: lessonsTotal > 0 },
      { id: "ten-lessons", icon: Target, label: "10 lessons complete", earned: lessonsTotal >= 10 },
      { id: "halfway", icon: Medal, label: "Half-way hero", earned: anyHalf },
      { id: "graduate", icon: GraduationCap, label: "Course completed", earned: anyDone },
      { id: "curious", icon: Compass, label: "Explored 5 courses", earned: recentCount >= 5 },
    ];
  }, [pairs, recentCount, lessonsTotal]);
}

/* -------------------------------- dashboard -------------------------------- */

export default function DashboardPage() {
  const { enrollments, hydrated, user, recentViews, activity } = useApp();
  const community = useCommunityCourses();

  const pairs = useMemo(() => {
    const pool = [...community, ...COURSES];
    return enrollments
      .map((enrollment) => ({ enrollment, course: pool.find((c) => c.id === enrollment.courseId) }))
      .filter((x): x is { enrollment: Enrollment; course: Course } => !!x.course);
  }, [enrollments, community]);

  const totals = useMemo(() => learnerTotals(pairs), [pairs]);
  const achievements = useAchievements(pairs, recentViews.length, totals.lessonsCompleted);

  const lastPair = useMemo(() => {
    return [...pairs].sort(
      (a, b) =>
        +new Date(b.enrollment.lastVisitedAt ?? b.enrollment.enrolledAt) -
        +new Date(a.enrollment.lastVisitedAt ?? a.enrollment.enrolledAt)
    )[0];
  }, [pairs]);

  const recommended = useMemo(
    () => recommendedCourses(new Set(enrollments.map((e) => e.courseId)), community, 4),
    [enrollments, community]
  );

  const recentCourses = useMemo(() => {
    const pool = [...community, ...COURSES];
    return recentViews
      .map((v) => pool.find((c) => c.id === v.courseId))
      .filter((c): c is Course => !!c)
      .slice(0, 4);
  }, [recentViews, community]);

  const activityFeed = useMemo(() => {
    return activity.slice(0, 6).map((a) => {
      const course = resolveCourse(a.courseId, community);
      return { ...a, course };
    });
  }, [activity, community]);

  const firstName = user?.name.split(" ")[0] ?? "learner";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-340 px-4 py-7 sm:px-6 lg:px-8" aria-busy>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-9 w-64" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-340 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">{today}</p>
          <h1 className="font-display mt-2 text-[26px] font-bold tracking-tight sm:text-[34px]">
            Welcome back{user ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-2 text-[14.5px] text-muted-foreground">
            {pairs.length > 0
              ? "Pick up exactly where you left off — your progress is saved on this device."
              : "Your learning journey starts with one course. Let's find it."}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5">
          <Flame className="size-4 text-amber-600" aria-hidden />
          <span className="text-[12.5px] font-semibold text-amber-700">4-day streak · simulated</span>
        </div>
      </header>

      {pairs.length === 0 ? (
        /* ------------------------------- Empty state ------------------------------ */
        <div className="mt-8">
          <div className="relative overflow-hidden rounded-2xl border border-violet-200/70 bg-accent p-8 sm:p-10">
            <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-violet-300/25 blur-2xl" aria-hidden />
            <div className="relative max-w-lg">
              <p className="font-display text-2xl font-bold tracking-tight text-violet-950">
                Start learning AI the practical way
              </p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-violet-950/60">
                Enroll in a free course in seconds — no card needed. Your dashboard fills with
                progress, milestones and recommendations as you learn.
              </p>
              <Button asChild size="lg" className="mt-6 shadow-md shadow-violet-600/20">
                <Link href="/explore">
                  <BookOpen aria-hidden />
                  Explore Courses
                </Link>
              </Button>
            </div>
          </div>
          <h2 className="font-display mt-10 mb-4 text-lg font-semibold">Recommended to start with</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recommendedCourses(new Set(), community, 4).map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Target}
              label="Overall progress"
              value={`${totals.overallPercent}%`}
              hint={`${totals.completedCourses} of ${totals.enrolledCount} completed`}
            />
            <StatCard icon={BookOpen} label="Enrolled courses" value={String(totals.enrolledCount)} hint="total" />
            <StatCard
              icon={Clock}
              label="Hours learned"
              value={(totals.minutesLearned / 60).toFixed(1)}
              hint="simulated playback"
            />
            <StatCard icon={ListChecks} label="Lessons completed" value={String(totals.lessonsCompleted)} hint="all courses" />
          </div>

          {/* Continue learning + activity rail */}
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {/* Continue learning */}
            {lastPair && (
              <section className="overflow-hidden rounded-xl border border-border bg-white shadow-card xl:col-span-2">
                <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                  <h2 className="font-display text-[15.5px] font-semibold">Continue learning</h2>
                  <Link href="/my-learning" className="group flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover">
                    All courses
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
                {(() => {
                  const p = progressOf(lastPair.course, lastPair.enrollment);
                  const instructor = instructorOf(lastPair.course);
                  return (
                    <div className="flex flex-col gap-5 p-5 sm:flex-row">
                      <Link
                        href={`/learn/${lastPair.course.id}`}
                        className="group relative block aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-64"
                      >
                        <Image
                          src={lastPair.course.thumbnail}
                          alt={lastPair.course.title}
                          fill
                          sizes="256px"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-zinc-950/0 transition-colors group-hover:bg-zinc-950/25">
                          <span className="flex size-12 items-center justify-center rounded-full bg-white/95 shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
                            <Play className="ml-0.5 size-5 fill-foreground text-foreground" aria-hidden />
                          </span>
                        </span>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5">
                            <AvatarFallback className={cn("text-[8px]", instructor?.avatarColor)}>
                              {instructor?.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[12px] text-muted-foreground">{instructor?.name}</span>
                        </div>
                        <h3 className="font-display mt-1.5 text-[17px] font-semibold tracking-tight">
                          {lastPair.course.title}
                        </h3>
                        {p.resumeLesson && (
                          <p className="mt-1 text-[13px] text-muted-foreground">
                            Next up: <span className="font-medium text-foreground">{p.resumeLesson.number} — {p.resumeLesson.lesson.title}</span>
                          </p>
                        )}
                        <div className="mt-3">
                          <div className="flex justify-between text-[11.5px] text-muted-foreground">
                            <span>{p.completedCount} of {p.totalLessons} lessons</span>
                            <span className="tabular-nums">{p.percent}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${p.percent}%` }} />
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <Button asChild>
                            <Link href={`/learn/${lastPair.course.id}`}>
                              <Play aria-hidden />
                              {p.isCompleted ? "Review course" : "Resume lesson"}
                            </Link>
                          </Button>
                          <Button asChild variant="outline">
                            <Link href={`/courses/${lastPair.course.slug}`}>Course details</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* Activity timeline */}
            <section className="rounded-xl border border-border bg-white p-5 shadow-card">
              <h2 className="font-display text-[15.5px] font-semibold">Learning activity</h2>
              {activityFeed.length === 0 ? (
                <p className="mt-4 text-[13px] text-muted-foreground">
                  Your activity appears here as you enroll and complete lessons.
                </p>
              ) : (
                <ul className="mt-4 space-y-3.5">
                  {activityFeed.map((a) => (
                    <li key={a.id} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex size-6.5 shrink-0 items-center justify-center rounded-lg",
                          a.kind === "enroll" && "bg-violet-100 text-violet-700",
                          a.kind === "lesson" && "bg-emerald-100 text-emerald-700",
                          a.kind === "order" && "bg-sky-100 text-sky-700"
                        )}
                      >
                        {a.kind === "enroll" ? (
                          <GraduationCap className="size-3.5" aria-hidden />
                        ) : a.kind === "lesson" ? (
                          <BadgeCheck className="size-3.5" aria-hidden />
                        ) : (
                          <Wallet className="size-3.5" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium">
                          {a.course ? (
                            <Link href={`/courses/${a.course.slug}`} className="hover:text-primary">
                              {a.course.title}
                            </Link>
                          ) : (
                            "Course"
                          )}
                        </p>
                        <p className="text-[11.5px] text-zinc-400">
                          {a.text} · {timeAgo(a.at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 border-t border-border pt-3 text-[11px] text-zinc-400">
                Activity is simulated locally on this device.
              </p>
            </section>
          </div>

          {/* Achievements */}
          <section className="mt-6 rounded-xl border border-border bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[15.5px] font-semibold">Milestones</h2>
              <Badge variant="secondary">Simulated</Badge>
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {achievements.map((a) => (
                <li
                  key={a.id}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition-colors",
                    a.earned ? "border-violet-200 bg-accent" : "border-border bg-muted/40 opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full",
                      a.earned ? "bg-primary text-white shadow-sm" : "bg-white text-zinc-300 shadow-card border border-border"
                    )}
                  >
                    {a.earned ? <a.icon className="size-4.5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                  </span>
                  <span className={cn("text-[11px] leading-tight font-medium", a.earned ? "text-accent-foreground" : "text-zinc-400")}>
                    {a.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Recommended */}
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Recommended AI courses</h2>
              <Link href="/explore" className="group flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover">
                View all
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {recommended.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </section>

          {/* Recently viewed */}
          {recentCourses.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display mb-4 text-lg font-semibold">Recently viewed</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {recentCourses.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
