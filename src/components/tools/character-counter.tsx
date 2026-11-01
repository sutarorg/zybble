"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Eraser } from "lucide-react";

/**
 * LinkedIn Character Counter.
 *
 * Pure client-side counting against LinkedIn's documented, publicly visible
 * limits. The headline limit (3,000 characters for a feed post) is enforced in
 * Zybble's own composer; the other figures below are the commonly published
 * ones for each surface and are labelled as guidance, not API guarantees.
 */

const LIMITS = [
  { label: "Feed post", limit: 3000, note: "LinkedIn's limit for a standard text post. Zybble enforces this in the composer." },
  { label: "Headline", limit: 220, note: "The line under your name on your profile." },
  { label: "Comment", limit: 1250, note: "Comments can be longer than the first line shows — expand before pasting." },
  { label: "Article headline", limit: 150, note: "For LinkedIn articles (long-form publishing)." },
  { label: "Page name", limit: 100, note: "LinkedIn Company Page display name." },
] as const;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
}

export function CharacterCounter() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const chars = text.length;
    const words = countWords(text);
    const lines = text ? text.split(/\n/).length : 0;
    const remaining = 3000 - chars;
    return { chars, words, lines, remaining };
  }, [text]);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the textarea stays selected so manual
      // copy still works.
    }
  }

  const percents = LIMITS.map((l) => (stats.chars / l.limit) * 100);

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* Editor */}
      <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">Your post</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              disabled={!text}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => {
                setText("");
                setCopied(false);
              }}
              disabled={!text}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Eraser className="size-4" aria-hidden />
              Clear
            </button>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="sr-only">Post text</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Start writing your LinkedIn post — or paste a draft to check its length…"
            className="block w-full resize-y rounded-xl border-0 bg-slate-50 px-4 py-3.5 text-[15px] leading-7 text-slate-900 ring-1 ring-slate-200 transition placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
        </label>

        {/* Live stats */}
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100">
            <dd className="text-2xl font-semibold tabular-nums text-slate-900">{stats.chars.toLocaleString()}</dd>
            <dt className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">characters</dt>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100">
            <dd className="text-2xl font-semibold tabular-nums text-slate-900">{stats.words.toLocaleString()}</dd>
            <dt className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">words</dt>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100">
            <dd className={`text-2xl font-semibold tabular-nums ${stats.remaining < 0 ? "text-red-600" : "text-slate-900"}`}>
              {stats.remaining.toLocaleString()}
            </dd>
            <dt className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              {stats.remaining < 0 ? "over the post limit" : "left for the post"}
            </dt>
          </div>
        </dl>

        {stats.remaining < 0 && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
            This draft is {Math.abs(stats.remaining).toLocaleString()} characters over LinkedIn&rsquo;s
            3,000-character post limit. Trim it before publishing — or move the details into a
            first comment.
          </p>
        )}
      </div>

      {/* Limits panel */}
      <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs lg:col-span-2 lg:self-start">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">LinkedIn limits</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          How your text currently measures against the limits of each surface. Limits are
          LinkedIn&rsquo;s and change occasionally — treat them as guidance and verify anything
          critical against LinkedIn&rsquo;s help centre.
        </p>
        <ul className="mt-5 space-y-4">
          {LIMITS.map((limit, i) => {
            const pct = Math.min(100, percents[i]);
            const over = stats.chars > limit.limit;
            return (
              <li key={limit.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">{limit.label}</span>
                  <span className={`tabular-nums ${over ? "font-semibold text-red-600" : "text-slate-500"}`}>
                    {stats.chars.toLocaleString()} / {limit.limit.toLocaleString()}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
                  role="presentation"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${over ? "bg-red-500" : "bg-brand-500"}`}
                    style={{ width: `${stats.chars ? Math.max(2, pct) : 0}%` }}
                  />
                </div>
                <p className="mt-1 text-[13px] leading-5 text-slate-500">{limit.note}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-[13px] leading-6 text-brand-900 ring-1 ring-brand-100">
          Want the counter inside the editor, with scheduling on top? That is the{" "}
          <Link href="/linkedin-scheduler" className="font-semibold underline underline-offset-2 hover:text-brand-700">
            Zybble composer
          </Link>{" "}
          — free plan included.
        </p>
      </div>
    </div>
  );
}
