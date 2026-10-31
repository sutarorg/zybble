"use client";

import { format, isAfter } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  Film,
  Globe2,
  ImageIcon,
  Loader2,
  Save,
  Send,
  ThumbsUp,
  MessageCircle,
  Repeat2,
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
import { ConnectLinkedInDialog } from "@/components/app/connect-linkedin-dialog";
import { apiPatch, apiPost, apiUpload, errorMessage } from "@/lib/api/client";
import { useLocalTimezone } from "@/lib/app/hooks";
import type { DashboardPost, LinkedInAccount, MediaAssetRef } from "@/lib/app/types";
import { cn } from "@/lib/utils";

/**
 * Post composer.
 *
 * Writes go straight to `/api/posts` (create) or `/api/posts/[id]` (update);
 * files are uploaded to private storage first and attached by id, so a post row
 * and its media can never disagree. The wall-clock date/time plus the chosen
 * IANA zone are sent as typed fields — the server resolves the UTC instant, so
 * DST is handled where the timezone database lives rather than in the browser.
 */

const LINKEDIN_MAX_CHARS = 3000;
const MAX_IMAGES = 9;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"];

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

type PendingMedia = {
  assetId: string;
  kind: MediaAssetRef["kind"];
  name: string;
  bytes: number;
  url: string | null;
  uploading: boolean;
};

type ComposerErrors = {
  text?: string;
  media?: string;
  schedule?: string;
  account?: string;
  form?: string;
};

export type PostComposerProps = {
  /** Present in edit mode. */
  initialPost?: DashboardPost;
  /** "yyyy-MM-dd" prefill from calendar day clicks. */
  initialDate?: string;
  /** Connected accounts that can publish. */
  accounts: LinkedInAccount[];
  /** Remaining Free-plan slots; null on Pro. */
  remainingScheduleSlots: number | null;
};

export function PostComposer({
  initialPost,
  initialDate,
  accounts,
  remainingScheduleSlots,
}: PostComposerProps) {
  const router = useRouter();
  const detectedTz = useLocalTimezone();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const publishable = accounts.filter((account) => account.canPublish && account.status === "active");

  const [text, setText] = useState(initialPost?.text ?? "");
  const [media, setMedia] = useState<PendingMedia[]>(
    (initialPost?.media ?? []).map((asset) => ({
      assetId: asset.id,
      kind: asset.kind,
      name: asset.name,
      bytes: asset.bytes,
      url: asset.url,
      uploading: false,
    })),
  );
  const [intent, setIntent] = useState<"draft" | "schedule">(
    initialPost?.status === "scheduled" ? "schedule" : "draft",
  );
  const [authorAccountId, setAuthorAccountId] = useState(
    initialPost?.authorAccountId ?? publishable[0]?.id ?? "",
  );
  const [date, setDate] = useState(initialPost?.scheduledAt?.slice(0, 10) ?? initialDate ?? "");
  const [time, setTime] = useState(
    initialPost?.scheduledAt ? format(new Date(initialPost.scheduledAt), "HH:mm") : "09:30",
  );
  const [timezone, setTimezone] = useState(initialPost?.timezone ?? "");
  const [errors, setErrors] = useState<ComposerErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{
    status: "draft" | "scheduled";
    id: string;
    scheduledAt: string | null;
    warning: string | null;
  } | null>(null);
  // Generated once per mount so a double-submitted form creates one post.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const resolvedTz = timezone || initialPost?.timezone || detectedTz;
  const charCount = text.length;
  const uploading = media.some((asset) => asset.uploading);

  const scheduledInstant = useMemo(() => {
    if (!date || !time) return null;
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const local = new Date(`${date}T00:00:00`);
    if (Number.isNaN(local.getTime())) return null;
    local.setHours(h, m, 0, 0);
    return local;
  }, [date, time]);

  function validate(): boolean {
    const next: ComposerErrors = {};

    if (!text.trim() && media.length === 0) {
      next.text = "Write something — or attach an image, video or document.";
    } else if (charCount > LINKEDIN_MAX_CHARS) {
      next.text = `LinkedIn posts are limited to ${LINKEDIN_MAX_CHARS.toLocaleString()} characters.`;
    }

    if (!authorAccountId) {
      next.account = "Connect a LinkedIn account to publish through before saving.";
    }

    if (uploading) {
      next.media = "Wait for the uploads to finish.";
    }

    if (intent === "schedule") {
      if (!scheduledInstant) {
        next.schedule = "Pick a date and time for this post.";
      } else if (!isAfter(scheduledInstant, new Date())) {
        next.schedule = "Scheduled time must be in the future.";
      } else if (remainingScheduleSlots !== null && remainingScheduleSlots <= 0 && !initialPost) {
        next.schedule =
          "You have used all scheduled posts included in the Free plan this month. Upgrade to Pro for unlimited scheduling.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(publishNow = false) {
    if (!validate()) return;

    setSaving(true);
    setErrors({});

    const payload = {
      authorAccountId,
      body: text.trim(),
      timezone: resolvedTz,
      mediaAssetIds: media.map((asset) => asset.assetId),
      intent: publishNow ? ("publish_now" as const) : intent === "schedule" ? ("schedule" as const) : ("draft" as const),
      ...(intent === "schedule" && !publishNow
        ? { scheduleDate: date, scheduleTime: time }
        : {}),
      ...(initialPost ? {} : { idempotencyKey }),
    };

    try {
      const result = initialPost
        ? await apiPatch<{ post: DashboardPost; warning: string | null }>(
            `/api/posts/${initialPost.id}`,
            payload,
          )
        : await apiPost<{ post: DashboardPost; warning: string | null }>("/api/posts", payload);

      setSaved({
        status: result.post.status === "published" ? "scheduled" : (result.post.status as "draft" | "scheduled"),
        id: result.post.id,
        scheduledAt: result.post.scheduledAt,
        warning: result.warning,
      });
      router.refresh();
    } catch (error) {
      setErrors({ form: errorMessage(error, "Could not save this post.") });
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(files: FileList | null, kind: "image" | "video" | "document") {
    if (!files?.length) return;

    const problems: string[] = [];
    const accepted: File[] = [];

    for (const file of Array.from(files)) {
      if (kind === "image") {
        if (!IMAGE_TYPES.includes(file.type)) {
          problems.push(`${file.name}: LinkedIn accepts JPG, PNG or GIF images.`);
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          problems.push(`${file.name}: images must be under 5 MB.`);
          continue;
        }
      }

      if (kind === "video") {
        if (file.type !== "video/mp4") {
          problems.push(`${file.name}: LinkedIn accepts MP4 video.`);
          continue;
        }
        if (file.size > MAX_VIDEO_BYTES) {
          problems.push(`${file.name}: video must be under 200 MB.`);
          continue;
        }
        if (media.some((asset) => asset.kind !== "image")) {
          problems.push("A post carries either one video, one document, or up to 9 images.");
          continue;
        }
      }

      if (kind === "document") {
        if (file.type !== "application/pdf") {
          problems.push(`${file.name}: documents must be PDF.`);
          continue;
        }
        if (file.size > MAX_DOCUMENT_BYTES) {
          problems.push(`${file.name}: documents must be under 100 MB.`);
          continue;
        }
        if (media.some((asset) => asset.kind !== "image")) {
          problems.push("A post carries either one video, one document, or up to 9 images.");
          continue;
        }
      }

      accepted.push(file);
    }

    if (kind === "image" && media.filter((asset) => asset.kind === "image").length + accepted.length > MAX_IMAGES) {
      problems.push(`LinkedIn allows up to ${MAX_IMAGES} images per post.`);
    }

    if (problems.length > 0) {
      setErrors((previous) => ({ ...previous, media: problems.join(" ") }));
      return;
    }

    setErrors((previous) => ({ ...previous, media: undefined }));

    for (const file of accepted) {
      const placeholderId = crypto.randomUUID();
      setMedia((previous) => [
        ...previous,
        { assetId: placeholderId, kind, name: file.name, bytes: file.size, url: null, uploading: true },
      ]);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const uploaded = await apiUpload<{ asset: MediaAssetRef }>("/api/posts/media", formData);
        setMedia((previous) =>
          previous.map((asset) =>
            asset.assetId === placeholderId
              ? {
                  assetId: uploaded.asset.id,
                  kind: uploaded.asset.kind,
                  name: uploaded.asset.name,
                  bytes: uploaded.asset.bytes,
                  url: uploaded.asset.url,
                  uploading: false,
                }
              : asset,
          ),
        );
      } catch (error) {
        setMedia((previous) => previous.filter((asset) => asset.assetId !== placeholderId));
        setErrors((previous) => ({
          ...previous,
          media: errorMessage(error, `Could not upload ${file.name}.`),
        }));
      }
    }
  }

  function removeMedia(assetId: string) {
    setMedia((previous) => previous.filter((asset) => asset.assetId !== assetId));
  }

  const tzOptions = TIMEZONES.includes(resolvedTz) ? TIMEZONES : [resolvedTz, ...TIMEZONES];

  /* ------------------------------- success ------------------------------- */
  if (saved) {
    const scheduled = saved.status === "scheduled";

    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-slate-200 shadow-xs">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            {scheduled ? <CalendarClock className="size-5" aria-hidden /> : <Save className="size-5" aria-hidden />}
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
            {scheduled ? "Scheduled" : "Draft saved"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            {scheduled && saved.scheduledAt ? (
              <>
                This post is queued for{" "}
                <strong className="font-medium">
                  {format(new Date(saved.scheduledAt), "EEEE d MMMM 'at' HH:mm")}
                </strong>{" "}
                ({resolvedTz}). Zybble publishes it through the LinkedIn API at that moment — no
                browser tab required.
              </>
            ) : (
              "The draft is saved in your workspace. Schedule it whenever you are ready."
            )}
          </p>

          {saved.warning && (
            <p className="mx-auto mt-4 max-w-md rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-6 text-amber-900 ring-1 ring-amber-200">
              {saved.warning}
            </p>
          )}

          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <Button asChild>
              <Link href={scheduled ? "/calendar" : "/posts"}>
                {scheduled ? "View in calendar" : "View drafts"}
              </Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSaved(null);
                if (!initialPost) {
                  setText("");
                  setMedia([]);
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
        {publishable.length === 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-hidden />
            <p className="min-w-0 flex-1 text-[13px] leading-6 text-amber-900">
              No LinkedIn account with publishing permission is connected yet. Connect one to save
              and schedule posts.
            </p>
            <ConnectLinkedInDialog>
              <Button size="sm">Connect LinkedIn</Button>
            </ConnectLinkedInDialog>
          </div>
        )}

        {/* Editor card */}
        <section aria-label="Post editor" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <Label htmlFor="composer-text" className="!mb-0">
              Post text
            </Label>
            <span
              className={cn(
                "text-xs tabular-nums",
                charCount > LINKEDIN_MAX_CHARS ? "font-semibold text-red-600" : "text-slate-500",
              )}
              aria-live="polite"
            >
              {charCount.toLocaleString()} / {LINKEDIN_MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <Textarea
            id="composer-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
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
              onClick={() => imageInputRef.current?.click()}
            >
              <ImageIcon aria-hidden />
              Images
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              multiple
              className="sr-only"
              aria-label="Upload images"
              onChange={(event) => {
                void uploadFiles(event.target.files, "image");
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => videoInputRef.current?.click()}
            >
              <Film aria-hidden />
              Video
            </Button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4"
              className="sr-only"
              aria-label="Upload a video"
              onChange={(event) => {
                void uploadFiles(event.target.files, "video");
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => documentInputRef.current?.click()}
            >
              <FileText aria-hidden />
              Document
            </Button>
            <input
              ref={documentInputRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              aria-label="Upload a document"
              onChange={(event) => {
                void uploadFiles(event.target.files, "document");
                event.target.value = "";
              }}
            />
            <span className="ml-auto text-xs text-slate-500">
              JPG/PNG/GIF ≤ 5 MB · MP4 ≤ 200 MB · PDF ≤ 100 MB
            </span>
          </div>
          {errors.media && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {errors.media}
            </p>
          )}

          {/* Media previews */}
          {media.length > 0 && (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {media.map((asset) => (
                <li
                  key={asset.assetId}
                  className="group relative overflow-hidden rounded-xl ring-1 ring-slate-200"
                >
                  <div className="flex aspect-[4/3] flex-col items-center justify-center bg-slate-50 p-3 text-center">
                    {asset.uploading ? (
                      <Loader2 className="size-5 animate-spin text-brand-600" aria-hidden />
                    ) : asset.kind === "image" && asset.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.url}
                        alt={`Preview of ${asset.name}`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <>
                        {asset.kind === "video" ? (
                          <Film className="size-5 text-slate-300" aria-hidden />
                        ) : (
                          <FileText className="size-5 text-slate-300" aria-hidden />
                        )}
                        <p className="mt-2 line-clamp-2 break-all text-[11px] text-slate-500">
                          {asset.name}
                        </p>
                      </>
                    )}
                    {asset.uploading && (
                      <p className="mt-2 text-[10px] text-slate-500">Uploading…</p>
                    )}
                  </div>
                  {!asset.uploading && (
                    <button
                      type="button"
                      onClick={() => removeMedia(asset.assetId)}
                      aria-label={`Remove ${asset.name}`}
                      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-slate-950/70 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Intent + schedule card */}
        <section aria-label="Publish options" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          {publishable.length > 0 && (
            <div className="mb-5">
              <Label htmlFor="author-account">Publish through</Label>
              <Select value={authorAccountId} onValueChange={setAuthorAccountId}>
                <SelectTrigger id="author-account" aria-label="LinkedIn account">
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  {publishable.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.displayName ?? account.profileUrn}
                      {account.canReadAnalytics ? "" : " · publishing only"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.account && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  {errors.account}
                </p>
              )}
            </div>
          )}

          <div
            className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"
            role="group"
            aria-label="Save as draft or schedule"
          >
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
                    onChange={(event) => setDate(event.target.value)}
                    aria-invalid={Boolean(errors.schedule)}
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-time">Time</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
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
                    {tzOptions.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone === detectedTz ? `${zone} (detected)` : zone}
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
                {remainingScheduleSlots !== null && !initialPost && (
                  <p className="mt-2 text-[13px] text-slate-500">
                    {remainingScheduleSlots} of 10 Free-plan scheduled posts left this month.
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

          {errors.form && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {errors.form}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
            <Button size="lg" onClick={() => void save(false)} disabled={saving} className="sm:min-w-36">
              {saving ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : intent === "schedule" ? (
                <CalendarClock aria-hidden />
              ) : (
                <Save aria-hidden />
              )}
              {intent === "schedule" ? "Schedule post" : "Save draft"}
            </Button>

            {initialPost && initialPost.status !== "published" && (
              <Button
                variant="secondary"
                size="lg"
                disabled={saving || uploading}
                onClick={() => void save(true)}
              >
                <Send aria-hidden />
                Publish now
              </Button>
            )}

            {initialPost && (
              <Button variant="ghost" size="lg" onClick={() => router.push("/posts")}>
                Cancel
              </Button>
            )}

            <p className="text-xs leading-5 text-slate-500 sm:ml-auto sm:max-w-56">
              The server converts this wall time to a UTC instant, so daylight saving is handled
              correctly.
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
              {(publishable.find((account) => account.id === authorAccountId)?.displayName ?? "You")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {publishable.find((account) => account.id === authorAccountId)?.displayName ??
                  "Your LinkedIn name"}
              </p>
              <p className="truncate text-xs text-slate-500">Your headline on LinkedIn</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
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
            {charCount > 240 && <span className="text-sm font-medium text-slate-500">…more</span>}
          </div>
          {media.length > 0 && (
            <div className={cn("grid gap-0.5", media.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
              {media
                .filter((asset) => asset.kind === "image" && asset.url)
                .slice(0, 4)
                .map((asset) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={asset.assetId} src={asset.url!} alt="" className="h-40 w-full object-cover" />
                ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 px-2 py-1.5">
            {[
              { icon: ThumbsUp, label: "Like" },
              { icon: MessageCircle, label: "Comment" },
              { icon: Repeat2, label: "Repost" },
              { icon: Send, label: "Send" },
            ].map((action) => (
              <span
                key={action.label}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-500"
              >
                <action.icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{action.label}</span>
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
