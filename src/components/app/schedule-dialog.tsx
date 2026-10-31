"use client";

import { format, isAfter } from "date-fns";
import { CalendarClock, Globe2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocalTimezone } from "@/lib/app/hooks";
import { createLocalPost } from "@/lib/app/local-posts";

interface ScheduleDialogProps {
  /** The day the user clicked; dialog closes when null. */
  date: Date | null;
  onClose: () => void;
  /** Open the full composer instead (prefilled with this date). */
  onOpenComposer: (date: Date) => void;
}

/**
 * Quick-schedule dialog from the calendar. Saves to the local preview store —
 * labelled as such in the footer. The form is keyed by the picked day so each
 * new selection starts clean (no effect-driven state resets).
 */
export function ScheduleDialog({ date, onClose, onOpenComposer }: ScheduleDialogProps) {
  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      {date && (
        <ScheduleForm
          key={date.toISOString()}
          date={date}
          onClose={onClose}
          onOpenComposer={onOpenComposer}
        />
      )}
    </Dialog>
  );
}

function ScheduleForm({
  date,
  onClose,
  onOpenComposer,
}: {
  date: Date;
  onClose: () => void;
  onOpenComposer: (date: Date) => void;
}) {
  const tz = useLocalTimezone();
  const [text, setText] = useState("");
  const [time, setTime] = useState("09:30");
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!text.trim()) {
      setError("Write the post text first.");
      return;
    }
    if (text.length > 3000) {
      setError("LinkedIn posts are limited to 3,000 characters.");
      return;
    }
    const [h, m] = time.split(":").map(Number);
    const instant = new Date(date);
    instant.setHours(h, m, 0, 0);
    if (!isAfter(instant, new Date())) {
      setError("Pick a time in the future.");
      return;
    }
    createLocalPost({
      text: text.trim(),
      media: [],
      status: "scheduled",
      scheduledAt: instant.toISOString(),
      timezone: tz,
    });
    onClose();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CalendarClock className="size-5 text-brand-600" aria-hidden />
          {format(date, "EEEE d MMMM")}
        </DialogTitle>
        <DialogDescription>
          Quick-schedule a text post for this day, or open the full composer for
          images and richer editing.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="quick-text">Post text</Label>
          <Textarea
            id="quick-text"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What goes out this day?"
            aria-invalid={Boolean(error)}
          />
        </div>
        <div className="flex items-end gap-4">
          <div>
            <Label htmlFor="quick-time">Time</Label>
            <Input
              id="quick-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-32"
            />
          </div>
          <p className="flex items-center gap-1.5 pb-2.5 text-[13px] text-slate-500">
            <Globe2 className="size-3.5" aria-hidden />
            {tz}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <DialogFooter className="items-center">
        <p className="mr-auto text-xs text-slate-400">Local preview — not synced to a server.</p>
        <Button variant="ghost" onClick={() => onOpenComposer(date)}>
          Full composer
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save}>Schedule</Button>
      </DialogFooter>
    </DialogContent>
  );
}
