"use client";

import { format, isAfter } from "date-fns";
import { CalendarClock, Globe2, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiPost, errorMessage } from "@/lib/api/client";
import { useLocalTimezone } from "@/lib/app/hooks";
import type { DashboardPost, LinkedInAccount } from "@/lib/app/types";

interface ScheduleDialogProps {
  /** The day the user clicked; dialog closes when null. */
  date: Date | null;
  /** Accounts that are allowed to publish. */
  accounts: LinkedInAccount[];
  /** Remaining Free-plan slots this month; null on Pro. */
  remainingScheduleSlots: number | null;
  onClose: () => void;
  /** Open the full composer instead (prefilled with this date). */
  onOpenComposer: (date: Date) => void;
  /** Called after a successful save so the calendar can refetch. */
  onScheduled?: () => void;
}

/**
 * Quick-schedule dialog from the calendar.
 *
 * Writes a real row through `POST /api/posts`. The wall-clock time and the
 * visitor's IANA zone are sent separately; the server resolves the UTC instant,
 * so a post scheduled for 09:30 in Kolkata stays 09:30 after a DST shift
 * elsewhere. Nothing is written if the request fails.
 */
export function ScheduleDialog({
  date,
  accounts,
  remainingScheduleSlots,
  onClose,
  onOpenComposer,
  onScheduled,
}: ScheduleDialogProps) {
  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      {date && (
        <ScheduleForm
          key={date.toISOString()}
          date={date}
          accounts={accounts}
          remainingScheduleSlots={remainingScheduleSlots}
          onClose={onClose}
          onOpenComposer={onOpenComposer}
          onScheduled={onScheduled}
        />
      )}
    </Dialog>
  );
}

function ScheduleForm({
  date,
  accounts,
  remainingScheduleSlots,
  onClose,
  onOpenComposer,
  onScheduled,
}: {
  date: Date;
  accounts: LinkedInAccount[];
  remainingScheduleSlots: number | null;
  onClose: () => void;
  onOpenComposer: (date: Date) => void;
  onScheduled?: () => void;
}) {
  const tz = useLocalTimezone();
  const publishable = accounts.filter((account) => account.canPublish && account.status === "active");

  const [text, setText] = useState("");
  const [time, setTime] = useState("09:30");
  const [authorAccountId, setAuthorAccountId] = useState(publishable[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!text.trim()) {
      setError("Write the post text first.");
      return;
    }
    if (text.length > 3000) {
      setError("LinkedIn posts are limited to 3,000 characters.");
      return;
    }
    if (!authorAccountId) {
      setError("Connect a LinkedIn account with publishing permission first.");
      return;
    }

    const [h, m] = time.split(":").map(Number);
    const instant = new Date(date);
    instant.setHours(h, m, 0, 0);
    if (!isAfter(instant, new Date())) {
      setError("Pick a time in the future.");
      return;
    }
    if (remainingScheduleSlots !== null && remainingScheduleSlots <= 0) {
      setError(
        "You have used all scheduled posts included in the Free plan this month. Upgrade to Pro for unlimited scheduling.",
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiPost<{ post: DashboardPost }>("/api/posts", {
        authorAccountId,
        body: text.trim(),
        intent: "schedule",
        timezone: tz,
        scheduleDate: format(date, "yyyy-MM-dd"),
        scheduleTime: time,
        mediaAssetIds: [],
        idempotencyKey: crypto.randomUUID(),
      });
      onScheduled?.();
      onClose();
    } catch (caught) {
      setError(errorMessage(caught, "Could not schedule this post."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CalendarClock className="size-5 text-brand-600" aria-hidden />
          {format(date, "EEEE d MMMM")}
        </DialogTitle>
        <DialogDescription>
          Quick-schedule a text post for this day, or open the full composer for images, video and
          documents.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="quick-text">Post text</Label>
          <Textarea
            id="quick-text"
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
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
              onChange={(event) => setTime(event.target.value)}
              className="w-32"
            />
          </div>
          <p className="flex items-center gap-1.5 pb-2.5 text-[13px] text-slate-500">
            <Globe2 className="size-3.5" aria-hidden />
            {tz}
          </p>
        </div>
        {publishable.length > 1 && (
          <div>
            <Label htmlFor="quick-account">Publish through</Label>
            <Select value={authorAccountId} onValueChange={setAuthorAccountId}>
              <SelectTrigger id="quick-account" aria-label="LinkedIn account">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {publishable.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.displayName ?? account.profileUrn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <DialogFooter className="items-center">
        <p className="mr-auto text-xs text-slate-500">
          {remainingScheduleSlots === null
            ? "Zybble publishes this through the LinkedIn API."
            : `${remainingScheduleSlots} Free-plan scheduled posts left this month.`}
        </p>
        <Button variant="ghost" onClick={() => onOpenComposer(date)}>
          Full composer
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={saving || publishable.length === 0}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          Schedule
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
