"use client";

import * as React from "react";
import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CloudUpload, Pencil } from "lucide-react";
import type { CurriculumSection } from "@/types";
import { useCreator } from "@/components/providers/creator-provider";
import { CurriculumEditor } from "@/components/creator/curriculum-editor";
import { StatusBadge } from "@/components/creator/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function CurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hydrated, getCourse, updateCourse } = useCreator();
  const course = hydrated ? getCourse(id) : undefined;

  /* Derived draft: the stored curriculum until the creator edits, then the draft. */
  const [draftSections, setDraftSections] = useState<CurriculumSection[] | null>(null);
  const sections = draftSections ?? course?.curriculum ?? null;
  const setSections = setDraftSections;
  const [savedOverride, setSavedOverride] = useState<string | null>(null);
  const savedSnapshot = savedOverride ?? (course ? JSON.stringify(course.curriculum) : "");
  const [saving, setSaving] = useState(false);

  if (!hydrated || sections === null) {
    return (
      <div aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }
  if (!course) notFound();

  const dirty = JSON.stringify(sections) !== savedSnapshot;

  const save = () => {
    setSaving(true);
    window.setTimeout(() => {
      const lessonsCount = sections.reduce((n, s) => n + s.lessons.length, 0);
      const durationMinutes = sections.reduce(
        (n, s) => n + s.lessons.reduce((m, l) => m + l.durationMinutes, 0),
        0
      );
      const downloadableResources = sections.reduce(
        (n, s) => n + s.lessons.filter((l) => l.downloadable).length,
        0
      );
      updateCourse(id, { curriculum: sections, lessonsCount, durationMinutes, downloadableResources });
      setSavedOverride(JSON.stringify(sections));
      setSaving(false);
      toast.success("Curriculum saved");
    }, 500);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/creator/courses">
            <ArrowLeft aria-hidden />
            My Courses
          </Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[24px] font-bold tracking-tight">Curriculum</h1>
            <div className="mt-1.5 flex items-center gap-2.5 text-[12.5px] text-muted-foreground">
              <span className="max-w-80 truncate font-medium text-foreground">{course.title}</span>
              <StatusBadge status={course.status} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/creator/courses/${id}/edit`}>
                <Pencil aria-hidden />
                Edit details
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/creator/courses/${id}/content`}>
                <CloudUpload aria-hidden />
                Course content
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <CurriculumEditor
          sections={sections}
          onChange={setSections}
          onSave={save}
          saving={saving}
        />
      </div>

      {dirty && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3 shadow-pop">
          <p className="text-[12.5px] font-medium text-amber-600">Unsaved curriculum changes</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSections(course.curriculum);
                toast("Changes discarded");
              }}
            >
              Discard
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              Save curriculum
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
