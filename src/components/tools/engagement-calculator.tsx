"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";

/**
 * LinkedIn Engagement Rate Calculator.
 *
 * All computation happens in the browser — no submission, no tracking of the
 * numbers entered. The denominator choice is the point of the tool: the same
 * engagement events divided by different bases answer different questions, and
 * the breakdown exists to make that explicit instead of hiding the formula.
 */

type Denominator = "impressions" | "reach" | "followers";

const DENOMINATORS: Array<{
  id: Denominator;
  label: string;
  hint: string;
}> = [
  {
    id: "impressions",
    label: "Impressions",
    hint: "The standard formula. Best for comparing your posts against each other.",
  },
  {
    id: "reach",
    label: "Unique reach",
    hint: "Response per unique person. Available for member posts via Zybble; LinkedIn shows impressions natively.",
  },
  {
    id: "followers",
    label: "Follower count",
    hint: "Response relative to audience size. Coarse — followers see only a fraction of your posts.",
  },
];

function parseCount(value: string): number {
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

const numberInputClass =
  "block w-full rounded-xl border-0 bg-white px-4 py-3 text-[15px] text-slate-900 ring-1 ring-slate-200 transition focus:outline-none focus:ring-2 focus:ring-brand-600";

export function EngagementCalculator() {
  const [impressions, setImpressions] = useState("");
  const [reactions, setReactions] = useState("");
  const [comments, setComments] = useState("");
  const [reposts, setReposts] = useState("");
  const [denominatorValue, setDenominatorValue] = useState("");
  const [denominator, setDenominator] = useState<Denominator>("impressions");

  const numbers = useMemo(() => {
    const imp = parseCount(impressions);
    const rea = parseCount(reactions);
    const com = parseCount(comments);
    const rep = parseCount(reposts);
    const base = denominator === "impressions" ? imp : parseCount(denominatorValue);
    return { imp, rea, com, rep, base };
  }, [impressions, reactions, comments, reposts, denominatorValue, denominator]);

  const { imp, rea, com, rep, base } = numbers;
  const engagements = rea + com + rep;
  const rate = base > 0 ? (engagements / base) * 100 : null;

  const activeDenominator = DENOMINATORS.find((d) => d.id === denominator)!;
  const showDenominatorInput = denominator !== "impressions";
  const inputsReady = denominator === "impressions" ? imp > 0 : base > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* Inputs */}
      <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs lg:col-span-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">Your post numbers</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Copy the figures from the post&rsquo;s analytics. Whole numbers only — the calculator
          rounds nothing away.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Impressions</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 4200"
              value={impressions}
              onChange={(e) => setImpressions(e.target.value)}
              className={`mt-1.5 ${numberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Reactions</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 85"
              value={reactions}
              onChange={(e) => setReactions(e.target.value)}
              className={`mt-1.5 ${numberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Comments</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 14"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className={`mt-1.5 ${numberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Reposts</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 6"
              value={reposts}
              onChange={(e) => setReposts(e.target.value)}
              className={`mt-1.5 ${numberInputClass}`}
            />
          </label>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-slate-700">Divide by</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {DENOMINATORS.map((d) => (
              <label
                key={d.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium ring-1 transition ${
                  denominator === d.id
                    ? "bg-brand-50 text-brand-800 ring-brand-300"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="denominator"
                  value={d.id}
                  checked={denominator === d.id}
                  onChange={() => setDenominator(d.id)}
                  className="size-4 accent-brand-600"
                />
                {d.label}
              </label>
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-5 text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {activeDenominator.hint}
          </p>
        </fieldset>

        {showDenominatorInput && (
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">
              {denominator === "reach" ? "Unique reach" : "Follower count"}
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={denominator === "reach" ? "e.g. 2600" : "e.g. 5400"}
              value={denominatorValue}
              onChange={(e) => setDenominatorValue(e.target.value)}
              className={`mt-1.5 ${numberInputClass}`}
            />
          </label>
        )}
      </div>

      {/* Result */}
      <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-soft lg:col-span-2 lg:self-start">
        <h2 className="text-lg font-semibold tracking-tight">Result</h2>
        {rate === null ? (
          <div className="mt-6 rounded-xl bg-white/5 px-5 py-8 text-center">
            <p className="text-4xl font-semibold tabular-nums text-white/30">—.——%</p>
            <p className="mt-3 text-sm leading-6 text-white/60">
              {inputsReady
                ? "Add your engagement numbers to see the result."
                : "Enter the post numbers to calculate the engagement rate."}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-xl bg-white/10 px-5 py-8 text-center">
              <p className="text-5xl font-semibold tabular-nums tracking-tight">
                {rate.toFixed(2)}%
              </p>
              <p className="mt-2 text-sm text-brand-200">engagement rate</p>
            </div>
            <dl className="mt-6 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-white/70">Engagements</dt>
                <dd className="font-medium tabular-nums">
                  {formatNumber(engagements)}
                  <span className="ml-1.5 text-white/50">
                    ({formatNumber(rea)} + {formatNumber(com)} + {formatNumber(rep)})
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-white/70">
                  Divided by {activeDenominator.label.toLowerCase()}
                </dt>
                <dd className="font-medium tabular-nums">{formatNumber(base)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-2.5">
                <dt className="text-white/70">Formula</dt>
                <dd className="text-right font-medium">
                  ({formatNumber(engagements)} ÷ {formatNumber(base)}) × 100
                </dd>
              </div>
            </dl>
            <div className="mt-6 rounded-xl bg-white/5 px-5 py-4 text-[13px] leading-6 text-white/70">
              {rate < 1
                ? "Below roughly 1% is common on LinkedIn — the useful question is whether this post beat your own median, not whether it passed a universal bar."
                : rate < 4
                  ? "A healthy middle band for many accounts. Compare it against your trailing ten posts rather than anyone else's average."
                  : "A strong result for the denominator you chose. Before celebrating, check the denominator isn't flattering you — impressions-based rates look different from follower-based ones."}
              <Link
                href="/blog/linkedin-engagement-rate-calculate-improve"
                className="mt-2 block font-medium text-brand-300 underline decoration-brand-300/40 underline-offset-4 transition hover:text-brand-200"
              >
                How to read and improve this number →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
