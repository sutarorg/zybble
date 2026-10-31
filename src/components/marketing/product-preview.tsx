import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Check,
  FileText,
  Hash,
  ImageIcon,
  LayoutList,
  Lock,
  PenLine,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { siteConfig } from "@/lib/site";

const queue = [
  { kind: "Text post", day: "Tue", tone: "bg-brand-500" },
  { kind: "Document carousel", day: "Thu", tone: "bg-sky-400" },
  { kind: "Article share", day: "Fri", tone: "bg-indigo-400" },
] as const;

const sideIcons = [PenLine, LayoutList, CalendarDays, BarChart3] as const;

/**
 * Hand-built illustration of the Zybble composer. Skeleton lines are used in
 * place of copy so no fabricated post content or metrics are ever implied.
 */
export function ProductPreview() {
  return (
    <figure
      aria-label="Illustrated preview of the Zybble composer and scheduling queue"
      className="relative"
    >
      {/* Window chrome */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-panel ring-1 ring-slate-900/10">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-slate-200" />
            <span className="size-2.5 rounded-full bg-slate-200" />
            <span className="size-2.5 rounded-full bg-slate-200" />
          </div>
          <div className="ml-2 flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/70">
            <Lock className="size-3" aria-hidden />
            app.zybble.app/composer
          </div>
          <span className="ml-auto hidden rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-brand-100 sm:block">
            Preview illustration
          </span>
        </div>

        <div className="grid grid-cols-[3.25rem_1fr]">
          {/* App sidebar */}
          <div className="flex flex-col items-center gap-1 border-r border-slate-100 py-4">
            <Image
              src={siteConfig.logoPath}
              alt=""
              width={24}
              height={24}
              className="mb-2 size-6 rounded-md"
            />
            {sideIcons.map((Icon, i) => (
              <span
                key={i}
                aria-hidden
                className={
                  i === 0
                    ? "flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
                    : "flex size-8 items-center justify-center rounded-lg text-slate-500"
                }
              >
                <Icon className="size-4" />
              </span>
            ))}
          </div>

          {/* Composer pane */}
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">New post</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                Draft autosaved
              </span>
            </div>

            <div className="rounded-xl p-4 ring-1 ring-slate-200">
              <div className="space-y-2.5" aria-hidden>
                <div className="h-2.5 w-11/12 rounded-full bg-slate-100" />
                <div className="h-2.5 w-full rounded-full bg-slate-100" />
                <div className="h-2.5 w-3/5 rounded-full bg-slate-100" />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex gap-1 text-slate-500" aria-hidden>
                  <span className="flex size-7 items-center justify-center rounded-md hover:bg-slate-50">
                    <ImageIcon className="size-4" />
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-md">
                    <FileText className="size-4" />
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-md">
                    <Hash className="size-4" />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500">
                    Save draft
                  </span>
                  <span className="rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white">
                    Schedule
                  </span>
                </div>
              </div>
            </div>

            {/* Schedule strip */}
            <div className="flex items-center gap-2.5 rounded-xl bg-brand-50/70 px-3.5 py-3 ring-1 ring-brand-100">
              <CalendarClock className="size-4 shrink-0 text-brand-600" aria-hidden />
              <p className="text-xs font-medium text-brand-900">
                Tuesday · 9:30 AM
                <span className="ml-1.5 font-normal text-brand-700/70">your audience time</span>
              </p>
              <Sparkles className="ml-auto size-3.5 text-brand-500" aria-hidden />
            </div>

            {/* Queue */}
            <div className="rounded-xl ring-1 ring-slate-200">
              <p className="border-b border-slate-100 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Upcoming this week
              </p>
              <ul className="divide-y divide-slate-100">
                {queue.map((item) => (
                  <li key={item.kind} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className={`size-2 rounded-full ${item.tone}`} aria-hidden />
                    <span className="text-xs font-medium text-slate-700">{item.kind}</span>
                    <span className="ml-auto text-[11px] font-medium text-slate-500">
                      {item.day}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      <Check className="size-2.5" aria-hidden />
                      Scheduled
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Floating accents */}
      <div
        aria-hidden
        className="absolute -left-4 top-16 hidden rotate-[-2deg] rounded-xl bg-white px-3.5 py-2.5 shadow-soft ring-1 ring-slate-900/5 lg:block xl:-left-10"
      >
        <p className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <Sparkles className="size-3.5 text-brand-500" />
          Best time to post detected
        </p>
      </div>
      <div
        aria-hidden
        className="absolute -right-3 bottom-14 hidden rotate-[2deg] rounded-xl bg-white px-3.5 py-2.5 shadow-soft ring-1 ring-slate-900/5 lg:block xl:-right-8"
      >
        <p className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <CalendarDays className="size-3.5 text-brand-500" />
          7-day calendar view
        </p>
      </div>
    </figure>
  );
}
