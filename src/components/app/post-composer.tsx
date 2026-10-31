"use client";

import { format, isAfter } from "date-fns";
import {
  CalendarClock,
  FileText,
  Film,
  Globe2,
  ImageIcon,
  Info,
  Save,
  ThumbsUp,
  MessageCircle,
  Repeat2,
  Send,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tooltip } from "@/components/ui/tooltip";
import { useLocalTimezone } from "@/lib/app/hooks";
import { createLocalPost, updateLocalPost, type LocalPost } from "@/lib/app/local-posts";
import { cn } from "@/lib/utils";

const LINKEDIN_MAX_CHARS = 3000;
const MAX_IMAGES = 9;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // LinkedIn image uploads: 5 MB
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

interface PendingMedia {
  id: string;
  file: File;
  previewUrl: string;
}

interface ComposerErrors {
  text?: string;
  media?: string;
  schedule?: string;
}

interface PostComposerProps {
  /** Present in edit mode — the local preview post being edited. */
  initialPost?: LocalPost;
  /** "yyyy-MM-dd" prefill from calendar day clicks. */
  initialDate?: string;
}

/**
 * Post composer — fully interactive, saved to the local preview store only.
 * Every action is labelled as local; nothing claims to hit a server.
 */
export function PostComposer({ initialPost, initialDate }: PostComposerProps) {
  const router = useRouter();
  const detectedTz = useLocalTimezone();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState(initialPost?.text ?? "");
  const [media, setMedia] = useState<PendingMedia[]>([]);
  const preexistingMedia = initialPost?.media ?? [];
  const [intent, setIntent] = useState<"draft" | "schedule">(
    initialPost?.status === "scheduled" ? "schedule" : "draft",
  );
  const [date, setDate] = useState(
    initialPost?.scheduledAt?.slice(0, 10) ?? initialDate ?? "",
  );
  const [time, setTime] = useState(
    initialPost?.scheduledAt ? format(new Date(initialPost.scheduledAt), "HH:mm") : "09:30",
  );
  const [timezone, setTimezone] = useState(initialPost?.timezone ?? "");
  const [errors, setErrors] = useState<ComposerErrors>({});
  const [saved, setSaved] = useState<{ status: "draft" | "scheduled"; id: string } | null>(null);

  const resolvedTz = timezone || detectedTz;
  const charCount = text.length;

  const scheduledInstant = useMemo(() => {
    if (!date || !time) return null;
    // Interpret the wall time in the chosen timezone via a trick: build a
    // local Date, then note the tz label for the backend in Prompt 3.
    const [h, m] = time.split(":").map(Number);
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(h, m, 0, 0);
    return d;
  }, [date, time]);

  function validate(): boolean {
    const next: ComposerErrors = {};
    if (!text.trim() && media.length === 0 && preexistingMedia.length === 0) {
      next.text = "Write something — or attach at least one image.";
    } else if (charCount > LINKEDIN_MAX_CHARS) {
      next.text = `LinkedIn posts are limited to ${LINKEDIN_MAX_CHARS.toLocaleString()} characters.`;
    }
    if (intent === "schedule") {
      if (!scheduledInstant) {
        next.schedule = "Pick a date and time for this post.";
      } else if (!isAfter(scheduledInstant, new Date())) {
        next.schedule = "Scheduled time must be in the future.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    const payload = {
      text: text.trim(),
      media: [
        ...preexistingMedia,
        ...media.map((m) => ({ id: m.id, name: m.file.name, mimeType: m.file.type, bytes: m.file.size })),
      ],
      scheduledAt: intent === "schedule" && scheduledInstant ? scheduledInstant.toISOString() : null,
      timezone: intent === "schedule" ? resolvedTz : null,
    };
    const result = initialPost
      ? (updateLocalPost(initialPost.id, { ...payload, status: intent === "schedule" ? "scheduled" : "draft" }),
        initialPost.id)
      : createLocalPost({ ...payload, status: intent === "schedule" ? "scheduled" : "draft" }).id;
    setSaved({ status: intent === "schedule" ? "scheduled" : "draft", id: result });
  }

  function onFilesPicked(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const problems: string[] = [];
    const accepted: PendingMedia[] = [];
    for (const file of incoming) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        problems.push(`${file.name}: only PNG, JPEG, GIF or WebP images (LinkedIn's supported image formats).`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        problems.push(`${file.name}: images must be under 5 MB.`);
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) });
    }
    if (media.length + preexistingMedia.length + accepted.length > MAX_IMAGES) {
      problems.push(`LinkedIn allows up to ${MAX_IMAGES} images per post.`);
    } else if (accepted.length) {
      setMedia((prev) => [...prev, ...accepted]);
    }
    if (problems.length) setErrors((e) => ({ ...e, media: problems.join(" ") }));
    else setErrors((e) => ({ ...e, media: undefined }));
  }

  function removeMedia(id: string) {
    setMedia((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((m) => m.id !== id);
    });
  }

  const tzOptions = TIMEZONES.includes(resolvedTz) ? TIMEZONES : [resolvedTz, ...TIMEZONES];

  /* ------------------------------- success ------------------------------- */
  if (saved) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-slate-200 shadow-xs">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            {saved.status === "scheduled" ? (
              <CalendarClock className="size-5" aria-hidden />
            ) : (
              <Save className="size-5" aria-hidden />
            )}
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
            {saved.status === "scheduled" ? "Scheduled — locally" : "Draft saved — locally"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            This {saved.status === "scheduled" ? "post is on your calendar" : "draft is in Posts"}{" "}
            as a <strong className="font-medium">browser-local preview</strong>. Server sync,
            real queueing and LinkedIn publishing activate when the backend ships.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <Button asChild>
              <Link href={saved.status === "scheduled" ? "/calendar" : "/posts"}>
                {saved.status === "scheduled" ? "View in calendar" : "View drafts"}
              </Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSaved(null);
                if (!initialPost) {
                  setText("");
                  setMedia((prev) => {
                    prev.forEach((m) => URL.revokeObjectURL(m.previewUrl));
                    return [];
                  });
                  setErrors({});
                }
              }}
            >
              {initialPost ? "Keep editing" : "Create another"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------- composer ------------------------------ */
  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {/* Editor card */}
        <section aria-label="Post editor" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <Label htmlFor="composer-text" className="!mb-0">Post text</Label>
            <span
              className={cn(
                "text-xs tabular-nums",
                charCount > LINKEDIN_MAX_CHARS ? "font-semibold text-red-600" : "text-slate-400",
              )}
              aria-live="polite"
            >
              {charCount.toLocaleString()} / {LINKEDIN_MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <Textarea
            id="composer-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder="Share a lesson, a take, a question… Write it once and schedule it for when your audience is actually reading."
            aria-invalid={Boolean(errors.text)}
            aria-describedby={errors.text ? "composer-text-error" : undefined}
            className="mt-2.5 resize-y"
          />
          {errors.text && (
            <p id="composer-text-error" role="alert" className="mt-2 text-sm text-red-600">
              {errors.text}
            </p>
          )}

          {/* Media row */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon aria-hidden />
              Add images
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              multiple
              className="sr-only"
              aria-label="Upload images"
              onChange={(e) => {
                onFilesPicked(e.target.files);
                e.target.value = "";
              }}
            />
            <Tooltip content="Video uploads require LinkedIn video API approval — enabled when the backend ships.">
              <span className="inline-flex">
                <Button type="button" variant="ghost" size="sm" disabled>
                  <Film aria-hidden />
                  Video
                </Button>
              </span>
            </Tooltip>
            <Tooltip content="Document carousels require LinkedIn document API approval — enabled when the backend ships.">
              <span className="inline-flex">
                <Button type="button" variant="ghost" size="sm" disabled>
                  <FileText aria-hidden />
                  Document
                </Button>
              </span>
            </Tooltip>
            <span className="ml-auto text-xs text-slate-400">PNG, JPEG, GIF, WebP · max 5 MB · up to 9</span>
          </div>
          {errors.media && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {errors.media}
            </p>
          )}

          {/* Media previews */}
          {(media.length > 0 || preexistingMedia.length > 0) && (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {preexistingMedia.map((m) => (
                <li key={m.id} className="relative overflow-hidden rounded-xl ring-1 ring-slate-200">
                  <div className="flex aspect-[4/3] flex-col items-center justify-center bg-slate-50 p-3 text-center">
                    <ImageIcon className="size-5 text-slate-300" aria-hidden />
                    <p className="mt-2 line-clamp-2 break-all text-[11px] text-slate-500">{m.name}</p>
                    <p className="mt-1 text-[10px] text-slate-400">preview from earlier session</p>
                  </div>
                </li>
              ))}
              {media.map((m) => (
                <li key={m.id} className="group relative overflow-hidden rounded-xl ring-1 ring-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.previewUrl}
                    alt={`Preview of ${m.file.name}`}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedia(m.id)}
                    aria-label={`Remove ${m.file.name}`}
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-slate-950/70 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Intent + schedule card */}
        <section aria-label="Publish options" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="Save as draft or schedule">
            {(
              [
                { id: "draft", label: "Save as draft", icon: Save },
                { id: "schedule", label: "Schedule", icon: CalendarClock },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={intent === option.id}
                onClick={() => setIntent(option.id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  intent === option.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                <option.icon className="size-4" aria-hidden />
                {option.label}
              </button>
            ))}
          </div>

          {intent === "schedule" && (
            <div className="mt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="schedule-date">Date</Label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={date}
                    min={format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={Boolean(errors.schedule)}
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-time">Time</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    aria-invalid={Boolean(errors.schedule)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="schedule-tz">Timezone</Label>
                <Select value={resolvedTz} onValueChange={setTimezone}>
                  <SelectTrigger id="schedule-tz" aria-label="Timezone">
                    <SelectValue placeholder="Timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {tzOptions.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz === detectedTz ? `${tz} (detected)` : tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scheduledInstant && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-slate-500">
                    <Globe2 className="size-3.5" aria-hidden />
                    Publishes {format(scheduledInstant, "EEEE d MMMM yyyy 'at' HH:mm")} ({resolvedTz})
                  </p>
                )}
                {errors.schedule && (
                  <p role="alert" className="mt-2 text-sm text-red-600">
                    {errors.schedule}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
            <Button size="lg" onClick={save} className="sm:min-w-36">
              {intent === "schedule" ? (
                <>
                  <CalendarClock aria-hidden />
                  Schedule post
                </>
              ) : (
                <>
                  <Save aria-hidden />
                  Save draft
                </>
              )}
            </Button>
            {initialPost && (
              <Button variant="ghost" size="lg" onClick={() => router.push("/posts")}>
                Cancel
              </Button>
            )}
            <p className="flex items-start gap-1.5 text-xs leading-5 text-slate-400 sm:ml-auto sm:max-w-56">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Preview mode: saved to this browser only — nothing leaves your device yet.
            </p>
          </div>
        </section>
      </div>

      {/* Live LinkedIn preview */}
      <aside aria-label="LinkedIn preview" className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2.5 flex items-center justify-between text-[13px] font-medium text-slate-500">
          LinkedIn preview
          <Badge variant="neutral">approximation</Badge>
        </p>
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-soft">
          <div className="flex items-start gap-3 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              You
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Your name</p>
              <p className="truncate text-xs text-slate-500">Your headline on LinkedIn</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                {intent === "schedule" && scheduledInstant
                  ? format(scheduledInstant, "d MMM · HH:mm")
                  : "Now"}{" "}
                · <Globe2 className="size-3" aria-hidden />
              </p>
            </div>
          </div>
          <div className="px-4 pb-3">
            {text ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden">
                {text}
              </p>
            ) : (
              <p className="text-sm italic text-slate-300">Your post text appears here as you type…</p>
            )}
            {charCount > 240 && (
              <span className="text-sm font-medium text-slate-400">…more</span>
            )}
          </div>
          {media.length > 0 && (
            <div className={cn("grid gap-0.5", media.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
              {media.slice(0, 4).map((m) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.previewUrl} alt="" className="h-40 w-full object-cover" />
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 px-2 py-1.5">
            {[
              { icon: ThumbsUp, label: "Like" },
              { icon: MessageCircle, label: "Comment" },
              { icon: Repeat2, label: "Repost" },
              { icon: Send, label: "Send" },
            ].map((a) => (
              <span key={a.label} className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-500">
                <a.icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{a.label}</span>
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
