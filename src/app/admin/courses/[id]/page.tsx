import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  EyeOff,
  FileText,
  MessageSquareWarning,
  ShieldAlert,
  StickyNote,
  XCircle,
} from "lucide-react";
import { getAdminCourseDetail } from "@/lib/server/admin";
import { money } from "@/lib/admin";
import { imagePath } from "@/lib/image-path";
import { StatusBadge } from "@/components/creator/status-badge";
import { ReviewTimeline } from "@/components/creator/review-timeline";
import { CourseDecisionBar } from "./course-decision-bar";
import { AddModerationNote } from "./add-moderation-note";

export const metadata = { title: "Course review" };
export const dynamic = "force-dynamic";

export default async function AdminCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getAdminCourseDetail(id);
  if (!course) notFound();

  const lessons = course.sections.flatMap((section) => section.lessons);
  const lessonsWithoutVideo = lessons.filter((lesson) => !lesson.hasVideo);
  const pendingVideos = lessons.filter((lesson) => lesson.hasVideo && !lesson.videoReady);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/courses" className="text-[12.5px] text-muted-foreground underline">
            <ArrowLeft className="inline size-3.5" aria-hidden /> All courses
          </Link>
          <h1 className="font-display mt-1 text-[26px] leading-tight font-bold tracking-tight">{course.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={course.status} />
            <span className="text-[12.5px] text-muted-foreground">
              {course.creatorName}
              {course.creatorUsername ? ` · @${course.creatorUsername}` : ""}
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              {course.categoryName ?? "Uncategorised"} · {course.level} · {course.language}
            </span>
          </div>
        </div>
        {course.status === "published" ? (
          <Link href={`/courses/${course.slug}`} className="text-[13px] font-medium text-primary underline">
            View the live page
          </Link>
        ) : null}
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Price", value: course.pricePaise === 0 ? "Free" : money(course.pricePaise) },
          { label: "Lessons", value: String(lessons.length) },
          { label: "Duration", value: `${course.durationMinutes} min` },
          { label: "Resources", value: String(course.resources.length) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-white px-4 py-3 shadow-card">
            <dt className="text-[12px] text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 font-display text-[17px] font-bold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      {lessons.length === 0 || lessonsWithoutVideo.length > 0 || pendingVideos.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3.5 text-[13px] text-amber-900">
          <p className="font-medium">Curriculum is not ready</p>
          <ul className="mt-1 list-disc pl-5 text-amber-800">
            {lessons.length === 0 ? <li>The course has no lessons.</li> : null}
            {lessonsWithoutVideo.length > 0 ? (
              <li>
                {lessonsWithoutVideo.length} lesson{lessonsWithoutVideo.length === 1 ? " has" : "s have"} no
                uploaded video: {lessonsWithoutVideo.slice(0, 5).map((lesson) => lesson.title).join(", ")}
                {lessonsWithoutVideo.length > 5 ? "…" : ""}
              </li>
            ) : null}
            {pendingVideos.length > 0 ? (
              <li>
                {pendingVideos.length} video{pendingVideos.length === 1 ? " is" : "s are"} still encoding in
                Bunny Stream.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <CourseDecisionBar
        courseId={course.id}
        status={course.status}
        paid={course.pricePaise > 0}
        settleable={true}
        hasLessons={lessons.length > 0}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
              <FileText className="size-4 text-primary" aria-hidden /> Course copy
            </h2>
            <p className="mt-3 text-[13.5px] leading-relaxed whitespace-pre-line">
              {course.description || "No description provided."}
            </p>
            {course.longDescription.length > 0 ? (
              <div className="mt-3 space-y-2 text-[13.5px] leading-relaxed">
                {course.longDescription.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            ) : null}

            {[
              { title: "What learners will be able to do", items: course.whatYouLearn },
              { title: "Requirements", items: course.requirements },
              { title: "Who this is for", items: course.audience },
            ]
              .filter((section) => section.items.length > 0)
              .map((section) => (
                <div key={section.title} className="mt-4">
                  <h3 className="text-[13px] font-semibold">{section.title}</h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                    {section.items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </section>

          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Curriculum</h2>
            {course.sections.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted-foreground">No sections.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {course.sections.map((section) => (
                  <div key={section.id}>
                    <p className="text-[13px] font-semibold">{section.title}</p>
                    <ul className="mt-1.5 space-y-1">
                      {section.lessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${
                              lesson.videoReady ? "bg-emerald-500" : lesson.hasVideo ? "bg-amber-500" : "bg-zinc-300"
                            }`}
                            aria-hidden
                          />
                          <span className="flex-1 truncate">{lesson.title}</span>
                          <span className="tabular-nums">{lesson.durationMinutes} min</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Creator</h2>
            <p className="mt-2 text-[13.5px] font-medium">{course.creatorName}</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Payout destination: {course.routeStatus?.startsWith("details_saved") ? "saved" : "not saved yet"}
            </p>
            {course.creatorBio ? (
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{course.creatorBio}</p>
            ) : null}
          </section>

          {course.resources.length > 0 ? (
            <section className="rounded-xl border border-border bg-white p-5 shadow-card">
              <h2 className="font-display text-[15px] font-semibold tracking-tight">Resources</h2>
              <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
                {course.resources.map((resource) => (
                  <li key={resource.id}>
                    {resource.title}{" "}
                    <span className="text-zinc-400">
                      ({Math.round(resource.sizeBytes / 1024)} KB)
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
              <MessageSquareWarning className="size-4 text-primary" aria-hidden /> Review history
            </h2>
            <ReviewTimeline
              events={course.reviewHistory.map((event) => ({
                id: event.id,
                at: event.at,
                status: event.toStatus,
                actor: event.actorRole,
                note: event.note,
              }))}
            />
          </section>

          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
              <StickyNote className="size-4 text-primary" aria-hidden /> Internal notes
            </h2>
            {course.moderationNotes.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted-foreground">No internal notes.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {course.moderationNotes.map((note) => (
                  <li key={note.id} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-[13px]">{note.text}</p>
                    <p className="mt-1 text-[11.5px] text-zinc-400">
                      {note.author ?? "Administrator"} · {new Date(note.createdAt).toLocaleString("en-IN")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <AddModerationNote courseId={course.id} />
          </section>
        </div>
      </div>
    </div>
  );
}