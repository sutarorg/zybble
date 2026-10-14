"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { submitCourseForReview } from "@/app/creator/actions";
import { Button } from "@/components/ui/button";

export function SubmitForReviewButton({ courseId, disabled }: { courseId: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={busy || disabled}
        onClick={() => {
          setBusy(true);
          setError(null);
          setMessage(null);
          void submitCourseForReview(courseId)
            .then((result) => {
              if (!result.ok) setError(result.error ?? "Could not submit the course");
              else setMessage("Submitted. An administrator will review it.");
              router.refresh();
            })
            .catch(() => setError("Could not submit the course"))
            .finally(() => setBusy(false));
        }}
      >
        <Send className="size-4" aria-hidden />
        {busy ? "Submitting…" : "Submit for review"}
      </Button>
      {error ? <span className="text-[12.5px] text-red-600">{error}</span> : null}
      {message ? <span className="text-[12.5px] text-emerald-700">{message}</span> : null}
    </div>
  );
}
