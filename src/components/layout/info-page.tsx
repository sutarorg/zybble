import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared chrome for informational pages (about, help, legal). */
export function InfoPage({
  label,
  title,
  description,
  updated,
  children,
  className,
}: {
  label: string;
  title: string;
  description?: string;
  updated?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-340 px-4 py-8 sm:px-6 sm:py-12 lg:px-8", className)}>
      <header className="max-w-3xl">
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">{label}</p>
        <h1 className="font-display mt-2 text-[28px] leading-tight font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        )}
        {updated && <p className="mt-3 text-[12.5px] text-zinc-400">Last updated: {updated}</p>}
      </header>
      {children}
    </div>
  );
}

/** Numbered legal section with heading. */
export function LegalSection({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display flex items-baseline gap-3 text-[17px] font-semibold tracking-tight">
        <span className="text-[13px] font-semibold text-zinc-400 tabular-nums">
          {String(index).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 pl-0 text-[14px] leading-relaxed text-muted-foreground sm:pl-9">
        {children}
      </div>
    </section>
  );
}

export function LegalNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-xl border border-violet-200 bg-accent p-4 text-[13px] leading-relaxed text-violet-950/70">
      {children}
    </div>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item.slice(0, 40)}>{item}</li>
      ))}
    </ul>
  );
}
