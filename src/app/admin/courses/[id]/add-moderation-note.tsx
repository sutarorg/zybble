"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addModerationNote } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function AddModerationNote({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        void addModerationNote(courseId, text)
          .then((result) => {
            if (!result.ok) setError(result.error ?? "Could not save the note");
            else {
              setText("");
              router.refresh();
            }
          })
          .finally(() => setBusy(false));
      }}
    >
      <Textarea
        rows={3}
        aria-label="Internal note"
        placeholder="Internal note — not shown to the creator"
        maxLength={2000}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={busy || !text.trim()}>
          {busy ? "Saving…" : "Add note"}
        </Button>
        {error ? <span className="text-[12px] text-red-600">{error}</span> : null}
      </div>
    </form>
  );
}