"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  Eye,
  ListTree,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import type { CreatorCourse } from "@/types";
import { formatCompact, formatDate, formatPrice } from "@/lib/format";
import { useCreator } from "@/components/providers/creator-provider";
import { StatusBadge } from "@/components/creator/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function CourseActions({ course, onDelete }: { course: CreatorCourse; onDelete: () => void }) {
  const translateUi = useTranslate();
  const router = useRouter();
  const { duplicateCourse, submitForReview } = useCreator();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={translateUi(`Actions for ${course.title}`)}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
          >
            <MoreHorizontal className="size-4.5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => router.push(`/creator/courses/${course.id}/edit`)}>
            <Pencil /><LocalizedText text={"Edit details"} /></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/creator/courses/${course.id}/curriculum`)}>
            <ListTree /><LocalizedText text={"Manage curriculum"} /></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/courses/${course.slug}`)}>
            <Eye /><LocalizedText text={"Preview public page"} /></DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const copy = duplicateCourse(course.id);
              if (copy) toast.success(`Duplicated as “${copy.title}”`);
            }}
          >
            <Copy /><LocalizedText text={"Duplicate"} /></DropdownMenuItem>
          {(course.status === "draft" || course.status === "changes_requested") && (
            <DropdownMenuItem
              onSelect={() => {
                submitForReview(course.id);
                toast.success("Submitted for review (simulated)");
              }}
            >
              <Send /><LocalizedText text={"Submit for review"} /></DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:bg-red-50 focus:text-destructive [&_svg]:text-destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 /><LocalizedText text={"Delete"} /></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle><LocalizedText text={"Delete “"} /><LocalizedText text={course.title} />”?</DialogTitle>
            <DialogDescription><LocalizedText text={"This removes the course from your studio in this browser. The preview's static catalog copy (if any) is unaffected. This action can't be undone here."} /></DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}><LocalizedText text={"Cancel"} /></Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
            ><LocalizedText text={"Delete course"} /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CoursesTable({
  courses,
  compact = false,
  emptySlot,
}: {
  courses: CreatorCourse[];
  compact?: boolean;
  emptySlot?: React.ReactNode;
}) {
  const translateUi = useTranslate();
  const { deleteCourse } = useCreator();

  if (courses.length === 0 && emptySlot) return <>{emptySlot}</>;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-160 text-left">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
              <th className="py-3 pr-4 pl-5"><LocalizedText text={"Course"} /></th>
              <th className="px-4 py-3"><LocalizedText text={"Status"} /></th>
              {!compact && <th className="px-4 py-3"><LocalizedText text={"Price"} /></th>}
              <th className="px-4 py-3">{compact ? "Students" : "Enrollments"}</th>
              {!compact && <th className="px-4 py-3"><LocalizedText text={"Updated"} /></th>}
              <th className="py-3 pr-5 pl-4 text-right">
                <span className="sr-only"><LocalizedText text={"Actions"} /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                <td className="py-3.5 pr-4 pl-5">
                  <div className="flex items-center gap-3">
                    {/* 16:9 thumbnail — consistent everywhere */}
                    <Link
                      href={`/creator/courses/${course.id}/edit`}
                      className="relative block aspect-video w-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                    >
                      <Image
                        src={course.thumbnail}
                        alt={translateUi("")}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={`/creator/courses/${course.id}/edit`}
                        className="block max-w-60 truncate text-[13.5px] font-semibold transition-colors hover:text-primary lg:max-w-80"
                      >
                        <LocalizedText text={course.title} />
                      </Link>
                      <p className="mt-0.5 max-w-60 truncate text-[12px] text-muted-foreground lg:max-w-80">
                        {course.lessonsCount}<LocalizedText text={"lessons ·"} />{course.level}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={course.status} />
                </td>
                {!compact && (
                  <td className="px-4 py-3.5 text-[13px] whitespace-nowrap tabular-nums">
                    <span className={cn(course.price === 0 && "font-semibold text-success")}>
                      <LocalizedText text={course.price === 0 ? "Free" : formatPrice(course.price)} />
                    </span>
                  </td>
                )}
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums">
                    <Users className="size-3.5 text-zinc-400" aria-hidden />
                    <LocalizedText text={formatCompact(course.studentsCount)} />
                  </span>
                </td>
                {!compact && (
                  <td className="px-4 py-3.5 text-[12.5px] whitespace-nowrap text-muted-foreground">
                    <LocalizedText text={formatDate(course.lastUpdated)} />
                  </td>
                )}
                <td className="py-3.5 pr-4 pl-4">
                  <div className="flex justify-end">
                    <CourseActions
                      course={course}
                      onDelete={() => {
                        deleteCourse(course.id);
                        toast.success(`Deleted “${course.title}” (locally)`);
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
