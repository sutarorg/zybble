"use client";

import * as React from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Check,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe2,
  HelpCircle,
  ImageIcon,
  LayoutGrid,
  Layers,
  Link2,
  Monitor,
  Play,
  ShieldCheck,
  Signal,
  Sparkles,
  UserCheck,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CourseCard } from "@/components/courses/course-card";
import { formatInr } from "@/lib/money";
import { formatDuration } from "@/lib/format";
import { imagePath } from "@/lib/image-path";
import { LEVEL_LABELS } from "@/lib/courses";
import {
  getCleanLessonDescription,
  parseLessonQuiz,
  parseLessonResources,
  type LessonKind,
} from "@/lib/course-wizard";
import {
  detectResourceKindBadge,
  formatResourceBytes,
} from "../curriculum/resources-lesson-panel";
import type { CategorySlug, Course as PublicCourseModel, CourseLanguage, CourseLevel } from "@/types";
import { cn } from "@/lib/utils";

export interface PreviewLesson {
  id: string;
  title: string;
  description: string;
  kind: LessonKind;
  durationMinutes: number;
  isPreview: boolean;
  hasVideo: boolean;
  playbackReady: boolean;
}

export interface PreviewSection {
  id: string;
  title: string;
  lessons: PreviewLesson[];
}

export interface PreviewResource {
  id: string;
  lessonId: string | null;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

interface PublicCoursePreviewProps {
  course: {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    description: string;
    longDescription: string[];
    categorySlug: string | null;
    categoryName: string | null;
    level: string;
    language: string;
    pricePaise: number;
    compareAtPaise: number;
    thumbnailKey: string | null;
    whatYouLearn: string[];
    requirements: string[];
    audience: string[];
    status: string;
  };
  instructor: {
    id: string;
    username: string;
    name: string;
    headline: string;
    bio: string;
    initials: string;
    avatarColor: string;
  };
  sections: PreviewSection[];
  resources: PreviewResource[];
}

export function PublicCoursePreview({
  course,
  instructor,
  sections,
  resources,
}: PublicCoursePreviewProps) {
  const [viewMode, setViewMode] = React.useState<"landing" | "card">("landing");

  const allLessons = React.useMemo(
    () => sections.flatMap((section) => section.lessons),
    [sections]
  );

  const videoCount = allLessons.filter((l) => l.kind === "video").length;
  const quizCount = allLessons.filter((l) => l.kind === "quiz").length;
  const readingCount = allLessons.filter((l) => l.kind === "reading").length;
  const previewCount = allLessons.filter((l) => l.isPreview).length;

  const totalMinutes = allLessons.reduce(
    (sum, l) => sum + (l.durationMinutes || 0),
    0
  );
  const durationLabel =
    totalMinutes > 0 ? formatDuration(totalMinutes) : "Self-paced";

  const thumbnailUrl = course.thumbnailKey
    ? imagePath("thumbnails", course.thumbnailKey)
    : "";

  const normalizedLevel: CourseLevel = (
    ["beginner", "intermediate", "advanced"].includes(course.level)
      ? course.level
      : "beginner"
  ) as CourseLevel;

  // Build a real `Course` model so the Catalog Card view renders the exact `<CourseCard>` component used on Explore
  const catalogCourseModel: PublicCourseModel = React.useMemo(
    () => ({
      id: course.id,
      slug: course.slug || course.id,
      title: course.title || "Untitled course",
      subtitle:
        course.subtitle ||
        "Add a subtitle in Step 1 to tell learners who this course is for.",
      description: course.description || "",
      longDescription: course.longDescription ?? [],
      category: ((course.categorySlug as CategorySlug) ||
        "development") as CategorySlug,
      instructorId: instructor.id,
      instructor: {
        id: instructor.id,
        username: instructor.username || "creator",
        name: instructor.name,
        headline: instructor.headline,
        bio: instructor.bio,
        initials: instructor.initials || "ZC",
        avatarColor: instructor.avatarColor || "bg-violet-100 text-violet-700",
        country: "IN",
        languages: [course.language || "English"],
      },
      thumbnail: thumbnailUrl || "/images/courses/course-placeholder.svg",
      pricePaise: course.pricePaise,
      compareAtPaise:
        course.compareAtPaise > course.pricePaise
          ? course.compareAtPaise
          : null,
      rating: 5.0,
      ratingsCount: 0,
      studentsCount: 0,
      level: normalizedLevel,
      language: (course.language || "English") as CourseLanguage,
      captions: [course.language || "English"],
      durationMinutes: totalMinutes,
      lessonsCount: allLessons.length,
      badge: "new",
      downloadableResources: resources.length,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      whatYouLearn: course.whatYouLearn,
      requirements: course.requirements,
      audience: course.audience,
      tags: [course.categoryName || "Course", LEVEL_LABELS[normalizedLevel]],
      curriculum: sections.map((sec) => ({
        id: sec.id,
        title: sec.title,
        lessons: sec.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          durationMinutes: l.durationMinutes,
          type: l.kind,
          freePreview: l.isPreview,
          downloadable: resources.some((r) => r.lessonId === l.id),
        })),
      })),
    }),
    [
      course,
      instructor,
      thumbnailUrl,
      normalizedLevel,
      totalMinutes,
      allLessons.length,
      resources,
      sections,
    ]
  );

  return (
    <section
      aria-label="Public course preview"
      className="overflow-hidden rounded-2xl border border-border bg-white shadow-card"
    >
      {/* Preview Mode Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-zinc-50/80 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
            <Eye className="size-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[14px] font-semibold text-foreground">
                Live Public Course Preview
              </h2>
              <Badge variant="violet">Real course data</Badge>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              Previewing exactly how learners see your course on Zybble once approved.
            </p>
          </div>
        </div>

        <div
          className="inline-flex rounded-lg border border-border bg-white p-0.5 shadow-2xs"
          role="tablist"
          aria-label="Preview format"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "landing"}
            onClick={() => setViewMode("landing")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
              viewMode === "landing"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Monitor className="size-3.5" aria-hidden="true" />
            Course Landing Page
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "card"}
            onClick={() => setViewMode("card")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
              viewMode === "card"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            Catalog Card
          </button>
        </div>
      </div>

      {/* MODE 1: Catalog Card View (reuses the actual `<CourseCard>` component if thumbnail exists, or renders card with placeholder) */}
      {viewMode === "card" ? (
        <div className="bg-zinc-50/50 p-6 sm:p-8">
          <div className="mx-auto max-w-sm">
            {thumbnailUrl ? (
              <div className="pointer-events-none select-none">
                <CourseCard course={catalogCourseModel} />
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 bg-muted p-4 text-center text-muted-foreground">
                  <ImageIcon className="size-6 text-zinc-400" aria-hidden="true" />
                  <p className="text-[12px] font-medium text-foreground">
                    16:9 thumbnail not uploaded yet
                  </p>
                  <Link
                    href={`/creator/courses/${course.id}/edit`}
                    className="text-[11.5px] font-medium text-primary underline"
                  >
                    Upload in Step 1 →
                  </Link>
                </div>
                <div className="space-y-2 p-4">
                  <Badge variant="violet">
                    {course.categoryName || "Uncategorized"}
                  </Badge>
                  <h3 className="font-display line-clamp-2 text-[15px] font-semibold text-foreground">
                    {course.title || "Untitled course"}
                  </h3>
                  <p className="line-clamp-2 text-[12.5px] text-muted-foreground">
                    {course.subtitle || "No subtitle provided yet."}
                  </p>
                  <div className="flex items-center justify-between border-t border-border pt-2.5">
                    <span className="text-[12px] text-muted-foreground">
                      {instructor.name}
                    </span>
                    <span className="font-display text-[15px] font-bold text-foreground">
                      {course.pricePaise === 0
                        ? "Free"
                        : formatInr(course.pricePaise)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <p className="mt-3 text-center text-[12px] text-muted-foreground">
              Rendered with the public{" "}
              <code className="font-mono text-primary">CourseCard</code>{" "}
              design used across Explore &amp; Search.
            </p>
          </div>
        </div>
      ) : (
        /* MODE 2: Full Public Course Landing Page Preview */
        <div className="divide-y divide-border">
          {/* Hero Section */}
          <div className="relative overflow-hidden bg-[#110D1E] p-5 text-white sm:p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-35 blur-3xl"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(168,85,247,0.5), transparent 70%)",
              }}
            />
            <div className="relative grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              {/* Left Column: Course Identity, Metadata, Creator */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="violet">
                    {course.categoryName || "Uncategorized"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white/85"
                  >
                    <Signal className="mr-1 size-3" aria-hidden="true" />
                    {LEVEL_LABELS[normalizedLevel]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white/85"
                  >
                    <Globe2 className="mr-1 size-3" aria-hidden="true" />
                    {course.language || "English"}
                  </Badge>
                  {course.pricePaise === 0 ? (
                    <Badge variant="emerald">Free Course</Badge>
                  ) : (
                    <Badge variant="sky">{formatInr(course.pricePaise)}</Badge>
                  )}
                </div>

                <div>
                  <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {course.title || "Untitled course"}
                  </h3>
                  {course.subtitle ? (
                    <p className="mt-2 text-[14.5px] leading-relaxed text-white/75">
                      {course.subtitle}
                    </p>
                  ) : (
                    <p className="mt-2 text-[13px] italic text-amber-300/90">
                      No subtitle added yet — add a clear 1-sentence hook in Step 1.
                    </p>
                  )}
                </div>

                {/* Metadata stats row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-white/75">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers
                      className="size-3.5 text-violet-300"
                      aria-hidden="true"
                    />
                    {sections.length}{" "}
                    {sections.length === 1 ? "section" : "sections"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen
                      className="size-3.5 text-violet-300"
                      aria-hidden="true"
                    />
                    {allLessons.length}{" "}
                    {allLessons.length === 1 ? "lesson" : "lessons"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3
                      className="size-3.5 text-violet-300"
                      aria-hidden="true"
                    />
                    {durationLabel}
                  </span>
                  {quizCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <HelpCircle
                        className="size-3.5 text-amber-300"
                        aria-hidden="true"
                      />
                      {quizCount} {quizCount === 1 ? "quiz" : "quizzes"}
                    </span>
                  ) : null}
                  {resources.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Download
                        className="size-3.5 text-sky-300"
                        aria-hidden="true"
                      />
                      {resources.length} downloadable{" "}
                      {resources.length === 1 ? "file" : "files"}
                    </span>
                  ) : null}
                </div>

                {/* Creator / Instructor Attribution */}
                <div className="flex items-center gap-3 pt-1">
                  <Avatar className="size-9 ring-1 ring-white/20">
                    <AvatarFallback
                      className={cn(
                        "text-[11px] font-bold",
                        instructor.avatarColor
                      )}
                    >
                      {instructor.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-white">
                        {instructor.name}
                      </span>
                      <UserCheck
                        className="size-3.5 text-emerald-400"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-[11.5px] text-white/65">
                      {instructor.headline}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Prominent 16:9 Course Thumbnail + Price Card */}
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 shadow-xl">
                <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                  {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl}
                      alt={course.title || "Course thumbnail"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-950/60 via-zinc-900 to-zinc-950 p-4 text-center">
                      <span className="flex size-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-300">
                        <ImageIcon className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-[12.5px] font-semibold text-white">
                          Course thumbnail missing
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/65">
                          Upload a 16:9 cover image in{" "}
                          <Link
                            href={`/creator/courses/${course.id}/edit`}
                            className="font-medium text-violet-300 underline hover:text-violet-200"
                          >
                            Step 1: Details &amp; thumbnail
                          </Link>
                        </p>
                      </div>
                    </div>
                  )}

                  {previewCount > 0 ? (
                    <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                      <Play
                        className="size-3 fill-current text-violet-300"
                        aria-hidden="true"
                      />
                      {previewCount} free preview{" "}
                      {previewCount === 1 ? "lesson" : "lessons"}
                    </span>
                  ) : null}
                </div>

                {/* Pricing & Enrollment Summary Bar inside Hero Card */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3.5 text-foreground">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-bold text-foreground">
                        {course.pricePaise === 0
                          ? "Free"
                          : formatInr(course.pricePaise)}
                      </span>
                      {course.compareAtPaise > course.pricePaise ? (
                        <span className="text-[13px] text-zinc-400 line-through">
                          {formatInr(course.compareAtPaise)}
                        </span>
                      ) : null}
                      <span className="text-[11.5px] text-muted-foreground">
                        {course.pricePaise === 0
                          ? "Free enrollment"
                          : "One-time payment · Lifetime access"}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-button-primary">
                    {course.pricePaise === 0
                      ? "Enroll for free"
                      : "Buy course"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* What you'll learn + Course Description / About Section */}
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-5">
              {course.whatYouLearn.length > 0 ? (
                <div className="rounded-xl border border-border bg-zinc-50/70 p-4 sm:p-5">
                  <h4 className="font-display text-[15px] font-semibold text-foreground">
                    What learners will be able to do
                  </h4>
                  <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    {course.whatYouLearn.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-[12.5px] leading-relaxed text-foreground"
                      >
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-2.5">
                <h4 className="font-display text-[16px] font-semibold text-foreground">
                  About this course
                </h4>
                {course.description ? (
                  <div className="whitespace-pre-line text-[13.5px] leading-relaxed text-muted-foreground">
                    {course.description}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-4 text-[12.5px] text-amber-900">
                    No course description written yet. Add at least 40 characters in{" "}
                    <Link
                      href={`/creator/courses/${course.id}/edit`}
                      className="font-semibold underline hover:text-amber-950"
                    >
                      Step 1: Details &amp; thumbnail
                    </Link>{" "}
                    so learners know what they will build and learn.
                  </div>
                )}
              </div>
            </div>

            {/* Course Includes & Instructor Snapshot */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-zinc-50/70 p-4">
                <h5 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  What&apos;s included
                </h5>
                <ul className="mt-3 space-y-2 text-[12.5px] text-foreground">
                  <li className="flex items-center gap-2">
                    <Video
                      className="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                    <span>
                      {videoCount} on-demand video{" "}
                      {videoCount === 1 ? "lesson" : "lessons"} ({durationLabel})
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <HelpCircle
                      className="size-3.5 text-amber-600"
                      aria-hidden="true"
                    />
                    <span>
                      {quizCount} interactive{" "}
                      {quizCount === 1 ? "quiz" : "quizzes"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText
                      className="size-3.5 text-sky-600"
                      aria-hidden="true"
                    />
                    <span>
                      {readingCount} reading/resource{" "}
                      {readingCount === 1 ? "lesson" : "lessons"} &amp;{" "}
                      {resources.length} downloadable{" "}
                      {resources.length === 1 ? "file" : "files"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Award
                      className="size-3.5 text-emerald-600"
                      aria-hidden="true"
                    />
                    <span>Certificate of completion</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck
                      className="size-3.5 text-emerald-600"
                      aria-hidden="true"
                    />
                    <span>Lifetime access on desktop and mobile</span>
                  </li>
                </ul>
              </div>

              {instructor.bio ? (
                <div className="rounded-xl border border-border bg-zinc-50/70 p-4">
                  <h5 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Meet your instructor
                  </h5>
                  <p className="mt-2 line-clamp-4 text-[12.5px] leading-relaxed text-muted-foreground">
                    {instructor.bio}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Curriculum Breakdown Section */}
          <div className="space-y-4 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-display text-[16px] font-semibold text-foreground">
                  Course curriculum ({sections.length}{" "}
                  {sections.length === 1 ? "section" : "sections"} ·{" "}
                  {allLessons.length}{" "}
                  {allLessons.length === 1 ? "lesson" : "lessons"})
                </h4>
                <p className="text-[12px] text-muted-foreground">
                  Full syllabus with video, quiz, and resource indicators as displayed on your public course page.
                </p>
              </div>
              <Link
                href={`/creator/courses/${course.id}/curriculum`}
                className="text-[12px] font-semibold text-primary hover:underline"
              >
                Edit curriculum →
              </Link>
            </div>

            {sections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-5 text-center text-[13px] text-amber-900">
                Your curriculum has no sections or lessons yet. Go to{" "}
                <Link
                  href={`/creator/courses/${course.id}/curriculum`}
                  className="font-semibold underline"
                >
                  Step 2: Curriculum
                </Link>{" "}
                to add your first section and lesson.
              </div>
            ) : (
              <div className="space-y-3">
                {sections.map((section, sIndex) => {
                  const secMinutes = section.lessons.reduce(
                    (sum, l) => sum + (l.durationMinutes || 0),
                    0
                  );
                  return (
                    <div
                      key={section.id}
                      className="overflow-hidden rounded-xl border border-border bg-white"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-zinc-50 px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[11px] font-semibold text-primary">
                            Section {sIndex + 1}
                          </span>
                          <span className="font-display text-[14px] font-semibold text-foreground">
                            {section.title}
                          </span>
                        </div>
                        <span className="text-[11.5px] text-muted-foreground">
                          {section.lessons.length}{" "}
                          {section.lessons.length === 1 ? "lesson" : "lessons"}
                          {secMinutes > 0 ? ` · ${secMinutes} min` : ""}
                        </span>
                      </div>

                      {section.lessons.length === 0 ? (
                        <p className="px-4 py-3 text-[12px] italic text-muted-foreground">
                          No lessons in this section yet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {section.lessons.map((lesson, lIndex) => {
                            const cleanDesc = getCleanLessonDescription(
                              lesson.description
                            );
                            const quizMeta =
                              lesson.kind === "quiz"
                                ? parseLessonQuiz(lesson.description)
                                : null;
                            const resLinks =
                              lesson.kind === "reading"
                                ? parseLessonResources(lesson.description).links
                                : [];
                            const lessonFiles = resources.filter(
                              (r) => r.lessonId === lesson.id
                            );

                            return (
                              <li
                                key={lesson.id}
                                className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <span className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                    {sIndex + 1}.{lIndex + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {lesson.kind === "video" ? (
                                        <Video
                                          className="size-3.5 shrink-0 text-primary"
                                          aria-hidden="true"
                                        />
                                      ) : lesson.kind === "quiz" ? (
                                        <HelpCircle
                                          className="size-3.5 shrink-0 text-amber-600"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <FileText
                                          className="size-3.5 shrink-0 text-sky-600"
                                          aria-hidden="true"
                                        />
                                      )}

                                      <span className="text-[13px] font-medium text-foreground">
                                        {lesson.title}
                                      </span>

                                      <Badge
                                        variant={
                                          lesson.kind === "video"
                                            ? "violet"
                                            : lesson.kind === "quiz"
                                              ? "amber"
                                              : "sky"
                                        }
                                        className="px-1.5 py-0 text-[10px]"
                                      >
                                        {lesson.kind === "video"
                                          ? "Video"
                                          : lesson.kind === "quiz"
                                            ? "Quiz"
                                            : "Resources"}
                                      </Badge>

                                      {lesson.isPreview ? (
                                        <Badge
                                          variant="emerald"
                                          className="px-1.5 py-0 text-[10px]"
                                        >
                                          Free preview
                                        </Badge>
                                      ) : null}

                                      {lesson.kind === "video" &&
                                      !lesson.playbackReady ? (
                                        <Badge
                                          variant="amber"
                                          className="px-1.5 py-0 text-[10px]"
                                        >
                                          {lesson.hasVideo
                                            ? "Encoding"
                                            : "Missing video"}
                                        </Badge>
                                      ) : null}

                                      {quizMeta ? (
                                        <span className="text-[11px] text-amber-700">
                                          {quizMeta.questions.length}{" "}
                                          {quizMeta.questions.length === 1
                                            ? "question"
                                            : "questions"}
                                        </span>
                                      ) : null}

                                      {lessonFiles.length + resLinks.length >
                                      0 ? (
                                        <span className="text-[11px] text-sky-700">
                                          {lessonFiles.length + resLinks.length}{" "}
                                          attached
                                        </span>
                                      ) : null}
                                    </div>

                                    {cleanDesc ? (
                                      <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">
                                        {cleanDesc}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
                                  {lesson.durationMinutes > 0 ? (
                                    <span className="font-mono text-[11.5px] text-muted-foreground">
                                      {lesson.durationMinutes} min
                                    </span>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Attached Downloadable Resources Summary (if any) */}
          {resources.length > 0 ? (
            <div className="space-y-3 p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-[15px] font-semibold text-foreground">
                  Included downloadable files ({resources.length})
                </h4>
                <Link
                  href={`/creator/courses/${course.id}/content`}
                  className="text-[12px] font-semibold text-primary hover:underline"
                >
                  Manage files →
                </Link>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {resources.map((res) => {
                  const badge = detectResourceKindBadge(
                    res.fileName,
                    res.contentType
                  );
                  return (
                    <div
                      key={res.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-zinc-50/70 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[12.5px] font-medium text-foreground">
                            {res.title}
                          </span>
                          <Badge
                            variant={badge.tone}
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {badge.label}
                          </Badge>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {res.fileName} · {formatResourceBytes(res.sizeBytes)}
                        </p>
                      </div>
                      <Sparkles
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export { ExternalLink, Link2 };
