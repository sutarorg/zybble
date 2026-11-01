import type { TocEntry } from "@/lib/blog";

/**
 * In-article contents box.
 *
 * Rendered inline rather than as a sticky sidebar: the prose column is a fixed
 * measure, and a sidebar would either fight it or need a layout the rest of
 * the marketing pages do not use. Sits above the fold on every breakpoint and
 * collapses to nothing when an article has fewer than three sections.
 */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  if (entries.length < 3) return null;

  return (
    <nav
      aria-labelledby="toc-heading"
      className="mt-10 rounded-2xl bg-brand-50/60 p-6 ring-1 ring-brand-100"
    >
      <h2
        id="toc-heading"
        className="text-sm font-semibold uppercase tracking-wider text-brand-800"
      >
        In this article
      </h2>
      <ol className="mt-4 space-y-2.5">
        {entries.map((entry, index) => (
          <li key={entry.id} className="flex gap-3 text-[15px] leading-6">
            <span
              aria-hidden
              className="mt-px shrink-0 tabular-nums text-xs font-semibold text-brand-400"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <a
              href={`#${entry.id}`}
              className="text-slate-700 underline-offset-[3px] transition-colors hover:text-brand-800 hover:underline"
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
