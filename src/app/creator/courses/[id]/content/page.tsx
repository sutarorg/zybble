"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Info, ListTree, Package } from "lucide-react";
import type { CreatorResource, UploadedMedia } from "@/types";
import { useCreator } from "@/components/providers/creator-provider";
import { UploadSlot, ResourceManager } from "@/components/creator/resource-manager";
import { StatusBadge } from "@/components/creator/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function CourseContentPage({ params }: { params: Promise<{ id: string }> }) {
  const translateUi = useTranslate();
  const { id } = use(params);
  const { hydrated, getCourse, updateCourse } = useCreator();
  const course = hydrated ? getCourse(id) : undefined;

  const lessons = useMemo(() => course?.curriculum.flatMap((s) => s.lessons) ?? [], [course]);
  const [lessonId, setLessonId] = useState<string>("");

  const effectiveLessonId = lessonId || lessons[0]?.id || "";

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }
  if (!course) notFound();

  const lesson = lessons.find((l) => l.id === effectiveLessonId);
  const uploads = course.uploads?.[effectiveLessonId] ?? [];
  const courseResources: CreatorResource[] = course.resourcesExtra ?? [];

  const setUploads = (list: UploadedMedia[]) => {
    updateCourse(id, { uploads: { ...(course.uploads ?? {}), [effectiveLessonId]: list } });
  };

  const setResources = (list: CreatorResource[]) => {
    updateCourse(id, {
      resourcesExtra: list,
      downloadableResources: list.length + lessons.filter((l) => l.downloadable).length,
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/creator/courses">
            <ArrowLeft aria-hidden /><LocalizedText text={"My Courses"} /></Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[24px] font-bold tracking-tight"><LocalizedText text={"Course content"} /></h1>
            <div className="mt-1.5 flex items-center gap-2.5 text-[12.5px] text-muted-foreground">
              <span className="max-w-80 truncate font-medium text-foreground"><LocalizedText text={course.title} /></span>
              <StatusBadge status={course.status} />
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/creator/courses/${id}/curriculum`}>
              <ListTree aria-hidden /><LocalizedText text={"Curriculum"} /></Link>
          </Button>
        </div>
      </div>

      {/* preview limitation notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
        <p className="text-[13px] leading-relaxed text-amber-900/80">
          <span className="font-semibold"><LocalizedText text={"Preview:"} /></span><LocalizedText text={"files you select are listed with their real names and sizes, but nothing is uploaded or processed. Persistent storage and video transcoding would connect here in production."} /></p>
      </div>

      {/* Lesson videos */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Lesson videos"} /></h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground"><LocalizedText text={"Attach one or more videos to a lesson. Saved as metadata only."} /></p>
          </div>
        </div>
        {lessons.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-muted/40 px-4 py-8 text-center text-[13px] text-muted-foreground">
            <Package className="mx-auto mb-2 size-5 text-zinc-300" aria-hidden /><LocalizedText text={"Add lessons to your curriculum first — then attach videos here."} /><div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <Link href={`/creator/courses/${id}/curriculum`}><LocalizedText text={"Open curriculum editor"} /></Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 max-w-sm space-y-1.5">
              <Label><LocalizedText text={"Lesson"} /></Label>
              <Select value={effectiveLessonId} onValueChange={setLessonId}>
                <SelectTrigger aria-label={translateUi("Choose lesson")}>
                  <SelectValue placeholder={translateUi("Choose a lesson")} />
                </SelectTrigger>
                <SelectContent>
                  {course.curriculum.map((s) =>
                    s.lessons.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        <LocalizedText text={s.title} /> · <LocalizedText text={l.title} />
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4">
              <UploadSlot
                key={effectiveLessonId}
                title={translateUi(lesson ? `Attach videos to “${lesson.title}”` : "Attach videos")}
                uploads={uploads}
                onChange={(list) => {
                  setUploads(list);
                  toast.success("Attachment list updated (local metadata only)");
                }}
              />
            </div>
          </>
        )}
      </section>

      {/* Downloadable resources */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Downloadable resources"} /></h2>
        <p className="mt-0.5 mb-4 text-[12.5px] text-muted-foreground"><LocalizedText text={"Files learners can download from the course page. Counts update the public card."} /></p>
        <ResourceManager resources={courseResources} onChange={setResources} />
      </section>
    </div>
  );
}
