"use client";

import * as React from "react";
import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CircleCheck, Eye, ListTree, Save } from "lucide-react";
import type { CourseDraft } from "@/types";
import { useCreator } from "@/components/providers/creator-provider";
import { draftFromCourse, validateDraftStep } from "@/lib/creator";
import { BasicsForm, OutcomesForm, PricingForm, ThumbnailPicker } from "@/components/creator/course-forms";
import { StatusBadge } from "@/components/creator/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hydrated, getCourse, applyDraft } = useCreator();

  const course = hydrated ? getCourse(id) : undefined;

  /* Derived draft: built once from the stored course, then owned by the form. */
  const initialDraft = React.useMemo(() => (course ? draftFromCourse(course) : null), [course]);
  const [draftOverride, setDraftOverride] = useState<CourseDraft | null>(null);
  const draft = draftOverride ?? initialDraft;
  const setDraft = (next: CourseDraft) => setDraftOverride(next);
  const [savedOverride, setSavedOverride] = useState<string | null>(null);
  const savedSnapshot = savedOverride ?? (initialDraft ? JSON.stringify(initialDraft) : "");
  const [tab, setTab] = useState("basics");
  const [saving, setSaving] = useState(false);

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }
  if (!course || !draft) notFound();

  const dirty = JSON.stringify(draft) !== savedSnapshot;
  const allErrors = { ...validateDraftStep(0, draft), ...validateDraftStep(1, draft), ...validateDraftStep(2, draft), ...validateDraftStep(3, draft) };

  const save = () => {
    setSaving(true);
    window.setTimeout(() => {
      applyDraft(id, draft);
      setSavedOverride(JSON.stringify(draft));
      setSaving(false);
      toast.success("Course details saved");
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
            <h1 className="font-display text-[24px] font-bold tracking-tight">{course.title}</h1>
            <div className="mt-1.5 flex items-center gap-2.5 text-[12.5px] text-muted-foreground">
              <StatusBadge status={course.status} />
              <span>·</span>
              <span>Last saved {new Date(course.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/creator/courses/${id}/curriculum`}>
                <ListTree aria-hidden />
                Curriculum
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/courses/${course.slug}`}>
                <Eye aria-hidden />
                Preview
              </Link>
            </Button>
            <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
              <Save aria-hidden />
              Save changes
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList>
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
            <TabsTrigger value="thumbnail">Thumbnail</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>

          <div className="mt-4 rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
            <TabsContent value="basics" className="mt-0">
              <BasicsForm draft={draft} onChange={(p) => setDraft({ ...draft, ...p })} errors={tab === "basics" ? allErrors : {}} />
            </TabsContent>
            <TabsContent value="outcomes" className="mt-0">
              <OutcomesForm draft={draft} onChange={(p) => setDraft({ ...draft, ...p })} errors={tab === "outcomes" ? allErrors : {}} />
            </TabsContent>
            <TabsContent value="thumbnail" className="mt-0">
              <ThumbnailPicker draft={draft} onChange={(p) => setDraft({ ...draft, ...p })} errors={tab === "thumbnail" ? allErrors : {}} />
            </TabsContent>
            <TabsContent value="pricing" className="mt-0">
              <PricingForm draft={draft} onChange={(p) => setDraft({ ...draft, ...p })} errors={tab === "pricing" ? allErrors : {}} />
            </TabsContent>
          </div>

          {/* Sticky save bar */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3 shadow-card">
            <p className="text-[12.5px] text-muted-foreground">
              {dirty ? (
                <span className="font-medium text-amber-600">You have unsaved changes</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <CircleCheck className="size-3.5 text-emerald-500" aria-hidden />
                  All changes saved
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {dirty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const d = draftFromCourse(course);
                    setDraft(d);
                    toast("Changes discarded");
                  }}
                >
                  Discard
                </Button>
              )}
              <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
                Save changes
              </Button>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
