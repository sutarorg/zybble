"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, Upload, ListVideo, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteCourse, submitCourseForReview } from "@/app/creator/actions";

/**
 * Per-course operations.
 *
 * Every action here calls a server action that re-reads ownership server-side;
 * the buttons carry no authority of their own.
 */
export function CourseRowActions({
  courseId,
  status,
  lessonsCount,
}: {
  courseId: string;
  status: string;
  lessonsCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const editable = status !== "pending";

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await action().catch(() => ({ ok: false, error: "Something went wrong" }));
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Something went wrong");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy} aria-label="Course actions">
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/creator/courses/${courseId}/curriculum`}>
              <ListVideo className="size-4" aria-hidden /> Curriculum ({lessonsCount})
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/creator/courses/${courseId}/content`}>
              <FileText className="size-4" aria-hidden /> Content & resources
            </Link>
          </DropdownMenuItem>
          {editable ? (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/creator/courses/${courseId}/edit`}>
                  <Pencil className="size-4" aria-hidden /> Edit details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/creator/courses/${courseId}/publish`}>
                  <Upload className="size-4" aria-hidden /> Submit for review
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}
          {status === "draft" ? (
            <DropdownMenuItem
              disabled={busy}
              onSelect={(event) => {
                event.preventDefault();
                if (!window.confirm("Delete this draft? This cannot be undone.")) return;
                void run(() => deleteCourse(courseId));
              }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="size-4" aria-hidden /> Delete draft
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {status === "changes_requested" ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void run(() => submitCourseForReview(courseId))}
        >
          Resubmit
        </Button>
      ) : null}
      {error ? <p className="max-w-56 text-right text-[11.5px] text-red-600">{error}</p> : null}
    </div>
  );
}