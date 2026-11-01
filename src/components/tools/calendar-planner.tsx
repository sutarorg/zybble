"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Eraser, Plus, Trash2 } from "lucide-react";

/**
 * LinkedIn Content Calendar planner.
 *
 * A genuinely usable weekly/monthly planner that persists in the browser's
 * localStorage — nothing is uploaded, and the CSV download is generated
 * client-side from the plan on screen. The reusable template is also available
 * as a plain CSV file (see the download link on the page) for people who would
 * rather start in a spreadsheet.
 */

export interface PlanEntry {
  id: string;
  /** ISO date, yyyy-mm-dd. */
  date: string;
  topic: string;
  format: string;
  status: string;
  notes: string;
}

const FORMATS = ["Text post", "Document carousel", "Video", "Poll", "Article share", "Event / announcement"] as const;
const STATUSES = ["Idea", "Drafting", "Ready to schedule", "Scheduled", "Published"] as const;

const STATUS_STYLES: Record<string, string> = {
  Idea: "bg-slate-100 text-slate-600 ring-slate-200",
  Drafting: "bg-amber-50 text-amber-800 ring-amber-200",
  "Ready to schedule": "bg-sky-50 text-sky-700 ring-sky-200",
  Scheduled: "bg-brand-50 text-brand-700 ring-brand-200",
  Published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const STORAGE_KEY = "zybble.calendar-planner.v1";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date): Date {
  const result = new Date(d);
  const day = (result.getDay() + 6) % 7; // Monday = 0
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `e${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

const EXAMPLE_WEEK: PlanEntry[] = (() => {
  const monday = startOfWeek(new Date());
  const base = (offset: number) => isoDate(addDays(monday, offset));
  return [
    {
      id: newId(),
      date: base(0),
      topic: "Lesson: what building this quarter taught us about scope",
      format: "Text post",
      status: "Ready to schedule",
      notes: "Hook: the mistake, not the win.",
    },
    {
      id: newId(),
      date: base(2),
      topic: "Perspective: where the industry is heading (my take)",
      format: "Document carousel",
      status: "Drafting",
      notes: "Six slides, one idea per slide.",
    },
    {
      id: newId(),
      date: base(4),
      topic: "Story: a customer moment worth retelling",
      format: "Text post",
      status: "Idea",
      notes: "Ask permission before naming anyone.",
    },
  ];
})();

function loadEntries(): PlanEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is PlanEntry => Boolean(e) && typeof e === "object" && typeof (e as PlanEntry).date === "string")
      .map((e) => ({
        id: e.id || newId(),
        date: e.date,
        topic: e.topic ?? "",
        format: e.format ?? FORMATS[0],
        status: e.status ?? STATUSES[0],
        notes: e.notes ?? "",
      }));
  } catch {
    return [];
  }
}

function toCsv(entries: PlanEntry[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ["Publishing date", "Content topic", "Post format", "Status", "Notes"].map(escape).join(",");
  const rows = entries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) =>
      [entry.date, entry.topic, entry.format, entry.status, entry.notes].map(escape).join(","),
    );
  return `\uFEFF${header}\n${rows.join("\n")}\n`;
}

export function CalendarPlanner() {
  const [entries, setEntries] = useState<PlanEntry[]>([]);
  const [view, setView] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState<Date>(() => startOfWeek(new Date()));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage one microtask after mount. The work cannot
    // happen during render (the server has no localStorage) and deferring
    // keeps the effect body free of synchronous setState — no cascading
    // renders on the first commit.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setEntries(loadEntries());
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Storage full or blocked (private mode) — the planner still works, it
      // just will not persist across reloads.
    }
  }, [entries, hydrated]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(cursor, i)),
    [cursor],
  );

  const monthGrid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  function addEntry(date: Date) {
    setEntries((prev) => [
      ...prev,
      { id: newId(), date: isoDate(date), topic: "", format: FORMATS[0], status: STATUSES[0], notes: "" },
    ]);
  }

  function updateEntry(id: string, patch: Partial<PlanEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function downloadCsv() {
    const csv = toCsv(entries.length > 0 ? entries : EXAMPLE_WEEK);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "linkedin-content-calendar.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const byDate = useMemo(() => {
    const map = new Map<string, PlanEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return map;
  }, [entries]);

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekLabel = `${cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(cursor, 6).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const empty = hydrated && entries.length === 0;

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-xs sm:p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full bg-slate-100 p-1" role="tablist" aria-label="Planner view">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => {
                setView(v);
                if (v === "month") setCursor(new Date(cursor));
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                view === v ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCursor((c) => (view === "week" ? addDays(c, -7) : new Date(c.getFullYear(), c.getMonth() - 1, 1)))}
            aria-label={view === "week" ? "Previous week" : "Previous month"}
            className="flex size-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ‹
          </button>
          <p className="min-w-36 text-center text-sm font-semibold text-slate-900" aria-live="polite">
            {view === "week" ? weekLabel : monthLabel}
          </p>
          <button
            type="button"
            onClick={() => setCursor((c) => (view === "week" ? addDays(c, 7) : new Date(c.getFullYear(), c.getMonth() + 1, 1)))}
            aria-label={view === "week" ? "Next week" : "Next month"}
            className="flex size-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="ml-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            Today
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {entries.length === 0 && (
            <button
              type="button"
              onClick={() => setEntries(EXAMPLE_WEEK.map((e) => ({ ...e, id: newId() })))}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              <CalendarDays className="size-4" aria-hidden />
              Load example week
            </button>
          )}
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Download className="size-4" aria-hidden />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => setEntries([])}
            disabled={entries.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eraser className="size-4" aria-hidden />
            Reset
          </button>
        </div>
      </div>

      {/* Empty state */}
      {empty && (
        <div className="mt-5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
          <p className="text-[15px] font-semibold text-slate-700">Your planner is empty</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Add your first post idea to any day below — or load the example week to see how a
            realistic cadence looks. Everything stays in this browser; nothing is uploaded.
          </p>
        </div>
      )}

      {/* Week view */}
      {view === "week" && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {weekDays.map((day) => {
            const key = isoDate(day);
            const dayEntries = byDate.get(key) ?? [];
            const isToday = key === isoDate(new Date());
            return (
              <div
                key={key}
                className={`flex min-h-44 flex-col rounded-xl p-3 ring-1 ${
                  isToday ? "bg-brand-50/50 ring-brand-200" : "bg-slate-50/60 ring-slate-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-brand-700" : "text-slate-500"}`}>
                    {DAY_LABELS[(day.getDay() + 6) % 7]} {day.getDate()}
                  </p>
                  <button
                    type="button"
                    onClick={() => addEntry(day)}
                    aria-label={`Add a post on ${day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`}
                    className="flex size-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-brand-600 hover:text-white"
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="mt-2 flex-1 space-y-2">
                  {dayEntries.map((entry) => (
                    <div key={entry.id} className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                      <input
                        value={entry.topic}
                        onChange={(e) => updateEntry(entry.id, { topic: e.target.value })}
                        placeholder="Post topic…"
                        aria-label="Post topic"
                        className="w-full rounded border-0 bg-transparent p-0 text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                      />
                      <div className="mt-2 flex gap-1.5">
                        <select
                          value={entry.format}
                          onChange={(e) => updateEntry(entry.id, { format: e.target.value })}
                          aria-label="Post format"
                          className="w-full min-w-0 flex-1 rounded-md border-0 bg-slate-50 px-1.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600"
                        >
                          {FORMATS.map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          aria-label="Remove this entry"
                          className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  ))}
                  {dayEntries.length === 0 && (
                    <button
                      type="button"
                      onClick={() => addEntry(day)}
                      className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-[12px] font-medium text-slate-400 transition hover:border-brand-400 hover:text-brand-600"
                    >
                      + plan a post
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month view */}
      {view === "month" && (
        <div className="mt-5">
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_LABELS.map((d) => (
              <p key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {d}
              </p>
            ))}
            {monthGrid.map((day) => {
              const key = isoDate(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = key === isoDate(new Date());
              const dayEntries = byDate.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`min-h-20 rounded-lg p-1.5 ring-1 transition ${
                    inMonth ? "bg-white ring-slate-200" : "bg-slate-50/60 ring-slate-100"
                  } ${isToday ? "!ring-brand-300 !bg-brand-50/50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] tabular-nums ${inMonth ? "text-slate-600" : "text-slate-400"}`}>
                      {day.getDate()}
                    </span>
                    <button
                      type="button"
                      onClick={() => addEntry(day)}
                      aria-label={`Add a post on ${day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      className="flex size-4.5 items-center justify-center rounded text-slate-300 transition hover:bg-brand-600 hover:text-white"
                    >
                      <Plus className="size-3" aria-hidden />
                    </button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEntries.slice(0, 2).map((entry) => (
                      <p
                        key={entry.id}
                        title={entry.topic || "Untitled"}
                        className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ring-1 ${STATUS_STYLES[entry.status] ?? STATUS_STYLES.Idea}`}
                      >
                        {entry.topic || "Untitled"}
                      </p>
                    ))}
                    {dayEntries.length > 2 && (
                      <p className="px-1 text-[10px] text-slate-400">+{dayEntries.length - 2} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[13px] text-slate-500">
            Status colours:{" "}
            {STATUSES.map((s) => (
              <span key={s} className={`ml-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${STATUS_STYLES[s]}`}>
                {s}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* Status editor for week view entries lives inline; notes are in a collapsible detail below the grid */}
      {view === "week" && entries.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">Status &amp; notes</h3>
          <ul className="mt-3 space-y-2.5">
            {entries
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((entry) => (
                <li key={entry.id} className="grid gap-2 rounded-xl bg-slate-50/70 p-3 ring-1 ring-slate-100 sm:grid-cols-[9rem_9rem_1fr]">
                  <p className="text-[13px] font-medium text-slate-700">
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  <select
                    value={entry.status}
                    onChange={(e) => updateEntry(entry.id, { status: e.target.value })}
                    aria-label={`Status for ${entry.topic || "untitled post"}`}
                    className={`w-full rounded-lg border-0 px-2 py-1.5 text-[12px] font-semibold ring-1 focus:outline-none focus:ring-2 focus:ring-brand-600 ${STATUS_STYLES[entry.status] ?? STATUS_STYLES.Idea}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <input
                    value={entry.notes}
                    onChange={(e) => updateEntry(entry.id, { notes: e.target.value })}
                    placeholder="Notes — hook angle, links, assets…"
                    aria-label={`Notes for ${entry.topic || "untitled post"}`}
                    className="w-full rounded-lg border-0 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
                  />
                </li>
              ))}
          </ul>
        </div>
      )}

      <p className="mt-5 text-[13px] leading-5 text-slate-500">
        Your plan is saved in this browser only (localStorage) — clear it any time with Reset, or
        take it with you via the CSV download.
      </p>
    </div>
  );
}
