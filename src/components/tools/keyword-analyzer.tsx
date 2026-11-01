"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eraser } from "lucide-react";
import { analysePost, type KeywordReport } from "@/lib/keyword-analysis";

/**
 * LinkedIn Keyword Analyzer UI.
 *
 * A thin layer over `analysePost` (see `src/lib/keyword-analysis.ts`), which
 * computes everything locally from the pasted text. The tool deliberately
 * presents NO search volume, difficulty or LinkedIn search numbers — see the
 * module comment there for why. "Related phrases" are the post's own most
 * frequent distinctive phrases, not an external suggestion API.
 */

const STATUS_STYLES: Record<KeywordReport["status"], { label: string; className: string; dot: string }> = {
  missing: {
    label: "Missing",
    className: "bg-red-50 text-red-700 ring-red-200",
    dot: "bg-red-500",
  },
  ok: {
    label: "Present",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  overused: {
    label: "Overused",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-500",
  },
};

const SAMPLE_POST = `Most founders treat LinkedIn analytics like a scoreboard. It isn't.

Analytics is a decision tool. When a post outperforms your median, the useful question is not "how do I repeat this exact post?" — it is "what did this post change about who saw my work?"

Last quarter I reviewed six months of posts in one sitting. The pattern was uncomfortable: my most-reached posts were not the ones that generated conversations. Reach flattered the topics I enjoyed writing; engagement rate told the truth about what my audience needed.

So I changed the mix. Fewer hot takes, more working notes. Fewer announcements, more decisions explained. Nothing about posting frequency changed — only what each post was for.

If your analytics view only shows you applause, it isn't analytics. It is a mirror.`;

const inputClass =
  "block w-full rounded-xl border-0 bg-white px-4 py-3 text-[15px] text-slate-900 ring-1 ring-slate-200 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600";

export function KeywordAnalyzer() {
  const [keywords, setKeywords] = useState("");
  const [text, setText] = useState("");

  const result = useMemo(() => analysePost(text, keywords), [text, keywords]);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Target keywords{" "}
              <span className="font-normal text-slate-400">(one per line or comma-separated, up to 12)</span>
            </span>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              rows={5}
              placeholder={"e.g.\nlinkedin analytics\nfounder content\nengagement rate"}
              className={`mt-1.5 ${inputClass} resize-y font-mono text-sm`}
            />
          </label>
          <p className="mt-2 text-[13px] leading-5 text-slate-500">
            The words and phrases you want this post to be found for. This tool analyses your text
            only — it does not estimate search volume or ranking difficulty, because no tool can
            know those for LinkedIn without LinkedIn&rsquo;s own data.
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="post-text" className="text-sm font-medium text-slate-700">
              Your post draft
            </label>
            <div className="flex gap-2">
              {text !== SAMPLE_POST && (
                <button
                  type="button"
                  onClick={() => setText(SAMPLE_POST)}
                  className="rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  Try a sample
                </button>
              )}
              <button
                type="button"
                onClick={() => setText("")}
                disabled={!text}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Eraser className="size-4" aria-hidden />
                Clear
              </button>
            </div>
          </div>
          <textarea
            id="post-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Paste your LinkedIn post draft here…"
            className={`mt-1.5 ${inputClass} resize-y leading-7`}
          />
        </div>
      </div>

      {/* Results */}
      {text.trim().length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
          <p className="text-[15px] font-semibold text-slate-700">Nothing to analyse yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Paste a post draft, add the keywords you care about, and the analysis appears here —
            frequency, density, placement, overuse and concrete suggestions. Everything is computed
            in your browser; nothing you paste is uploaded or stored.
          </p>
        </div>
      ) : !result.analysable ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
          <p className="text-[15px] font-semibold text-slate-700">A little more text, please</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            The draft is {result.totalWords} {result.totalWords === 1 ? "word" : "words"}. Keyword
            patterns only mean something above roughly 20 words.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Keyword table */}
          {result.keywordReports.length > 0 && (
            <section aria-labelledby="kw-results-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
              <h2 id="kw-results-heading" className="text-lg font-semibold tracking-tight text-slate-950">
                Keyword report
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Density is occurrences ÷ {result.totalWords.toLocaleString()} words. As a rule of
                thumb, anything above ~3% for one phrase starts to read as stuffing.
              </p>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="py-2.5 pr-4 font-semibold text-slate-900">Keyword</th>
                      <th scope="col" className="py-2.5 pr-4 font-semibold text-slate-900">Status</th>
                      <th scope="col" className="py-2.5 pr-4 text-right font-semibold text-slate-900">Count</th>
                      <th scope="col" className="py-2.5 pr-4 text-right font-semibold text-slate-900">Density</th>
                      <th scope="col" className="py-2.5 font-semibold text-slate-900">Placement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.keywordReports.map((report) => {
                      const style = STATUS_STYLES[report.status];
                      return (
                        <tr key={report.keyword} className="border-b border-slate-100">
                          <td className="py-3 pr-4 font-medium text-slate-900">{report.keyword}</td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style.className}`}>
                              <span aria-hidden className={`size-1.5 rounded-full ${style.dot}`} />
                              {style.label}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{report.occurrences}</td>
                          <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{report.density}%</td>
                          <td className="py-3 text-[13px] leading-5 text-slate-600">
                            {report.occurrences === 0
                              ? "—"
                              : [
                                  report.inHook ? "hook" : null,
                                  report.inClosing ? "closing" : null,
                                  !report.inHook && !report.inClosing ? "body only" : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Emphasis */}
            <section aria-labelledby="emphasis-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
              <h2 id="emphasis-heading" className="text-lg font-semibold tracking-tight text-slate-950">
                What this text emphasises
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                The phrases your draft repeats most — measured from the text itself. These are
                genuine content signals, not search data.
              </p>
              {result.topWords.length === 0 && result.topBigrams.length === 0 ? (
                <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-100">
                  No phrase repeats enough to stand out yet. That usually means the draft covers many
                  topics evenly — worth asking which single idea the post is about.
                </p>
              ) : (
                <div className="mt-5 space-y-5">
                  {result.topBigrams.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phrases</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {result.topBigrams.map((hit) => (
                          <li
                            key={hit.phrase}
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[13px] font-medium text-brand-800 ring-1 ring-brand-100"
                          >
                            {hit.phrase}
                            <span className="tabular-nums text-brand-500">×{hit.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.topWords.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Repeated words</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {result.topWords.map((hit) => (
                          <li
                            key={hit.phrase}
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-medium text-slate-700 ring-1 ring-slate-200"
                          >
                            {hit.phrase}
                            <span className="tabular-nums text-slate-400">×{hit.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Suggestions */}
            <section aria-labelledby="suggestions-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
              <h2 id="suggestions-heading" className="text-lg font-semibold tracking-tight text-slate-950">
                Suggestions
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Each suggestion follows from a finding above — no generic advice.
              </p>
              <ul className="mt-5 space-y-3.5">
                {result.suggestions.map((suggestion) => (
                  <li key={suggestion} className="flex gap-3 text-sm leading-6 text-slate-700">
                    <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="text-center text-sm text-slate-500">
            Analysis runs entirely in your browser — nothing you paste leaves this page. Want the
            numbers after publishing too?{" "}
            <Link href="/linkedin-analytics" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800">
              Zybble&rsquo;s analytics
            </Link>{" "}
            covers what actually happens once a post is live.
          </p>
        </div>
      )}
    </div>
  );
}
