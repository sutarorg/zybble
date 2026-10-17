"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitCourseForReview } from "@/app/creator/actions";

interface SubmitForReviewButtonProps {
  courseId: string;
  courseSlug: string;
  status: string;
  ready: boolean;
  blockersCount: number;
}

export function SubmitForReviewButton({
  courseId,
  courseSlug,
  status,
  ready,
  blockersCount,
}: SubmitForReviewButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(status === "pending");
  const [draftAck, setDraftAck] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmitForReview() {
    if (busy || submitted || status === "published" || !ready) return;
    setBusy(true);
    setError(null);
    setDraftAck(false);
    try {
      const result = await submitCourseForReview(courseId);
      if (!result.ok) {
        setError(result.error ?? "Could not submit course for review.");
        return;
      }
      setSubmitted(true);
      router.refresh();
    } catch {
      setError("Network error while submitting course for review.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "published") {
    return (
      <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-[13px] text-emerald-900">
        <div className="flex items-start gap-2.5">
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Course is live on Zybble</p>
            <p className="mt-0.5 text-[12px] text-emerald-800">
              Learners can discover and enroll in your course right now.
            </p>
          </div>
        </div>
        <Link
          href={`/courses/${courseSlug}`}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-emerald-900 transition-colors hover:bg-emerald-50"
        >
          Open public course page
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (submitted || status === "pending") {
    return (
      <div className="space-y-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-[13px] text-amber-950">
        <div className="flex items-start gap-2.5">
          <Clock3
            className="mt-0.5 size-4 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Submitted for admin review</p>
            <p className="mt-0.5 text-[12px] text-amber-800">
              Your course is in the moderation queue. Reviewers check video playback, curriculum quality, and pricing before publishing it to the catalog.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className="w-full"
        >
          <CheckCircle2
            className="size-3.5 text-amber-600"
            aria-hidden="true"
          />
          Awaiting review decision
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-700"
        >
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {draftAck ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[12px] text-emerald-800"
        >
          <CheckCircle2
            className="size-3.5 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <span>
            Draft saved. You can safely leave and return anytime from Creator Studio.
          </span>
        </div>
      ) : null}

      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          disabled={!ready || busy}
          onClick={() => void handleSubmitForReview()}
          className="w-full justify-center gap-2"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {busy ? "Submitting for review…" : "Submit course for review"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setDraftAck(true)}
          className="w-full justify-center gap-1.5"
        >
          <Save className="size-3.5" aria-hidden="true" />
          Keep as draft for now
        </Button>
      </div>

      {!ready ? (
        <p className="text-center text-[11.5px] text-amber-700">
          Complete {blockersCount}{" "}
          {blockersCount === 1 ? "remaining item" : "remaining items"} in the checklist above to unlock submission.
        </p>
      ) : (
        <p className="text-center text-[11.5px] text-muted-foreground">
          Submitting locks a review snapshot for Zybble moderators while keeping your draft safe.
        </p>
      )}
    </div>
  );
}
