import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared admin presentation primitives.
 *
 * Small and deliberately few. The visual language is the one already used by
 * the product: white surfaces, `slate-200` borders, a single blue accent, and
 * tabular numerals so columns of figures line up.
 */

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">{description}</p>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

/** A bordered surface. No shadow by default — borders read cleaner at these sizes. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white", className)}
    >
      {title ? (
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  /** `null` renders an em-dash. We never substitute a fabricated number. */
  value: string | number | null;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[12px] font-medium text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums",
          accent ? "text-brand-600" : "text-slate-950",
        )}
      >
        {value === null ? "—" : value}
      </p>
      {hint ? <p className="mt-2 text-[11px] leading-4 text-slate-500">{hint}</p> : null}
    </div>
  );
}

export type PillTone = "neutral" | "success" | "warning" | "danger" | "info";

const PILL_TONES: Record<PillTone, string> = {
  neutral: "bg-slate-50 text-slate-600 ring-slate-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-brand-50 text-brand-700 ring-brand-100",
};

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: PillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** A compact, scrollable table with a sticky header. */
export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-max border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        "whitespace-nowrap border-b border-slate-100 px-4 py-2.5 text-[13px] text-slate-700",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-[13px] text-slate-500">
        {children}
      </td>
    </tr>
  );
}
