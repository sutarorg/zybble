import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shared admin presentation primitives.
 *
 * The surfaces here intentionally copy the product's own: `rounded-2xl
 * bg-white ring-1 ring-slate-200 shadow-xs`. The design system prefers
 * `ring-1` over `border` on cards because a ring is drawn outside the box and
 * cannot shift layout, and it keeps the internal console reading as part of
 * the same product rather than a second skin.
 *
 * Only one saturated blue appears per viewport — `brand-600` — used for the
 * accent figure and the active navigation row. Everything else is slate.
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-balance text-[26px] font-semibold leading-8 tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-slate-500">{description}</p>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

/** A bordered surface matching the product's section panels. */
export function Panel({
  title,
  description,
  action,
  icon,
  children,
  className,
  padded = true,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  /** Optional leading icon, rendered in the product's brand-tinted chip. */
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  const Icon = icon;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-xs",
        className,
      )}
    >
      {title ? (
        <header className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Icon className="size-4" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold tracking-tight text-slate-900">{title}</h2>
              {description ? (
                <p className="mt-0.5 text-[12px] leading-5 text-slate-500">{description}</p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={padded ? "p-5 sm:p-6" : ""}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  /** `null` renders an em-dash. We never substitute a fabricated number. */
  value: string | number | null;
  hint?: string;
  icon?: LucideIcon;
  accent?: boolean;
}) {
  const Icon = icon;

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-5 text-slate-600">{label}</p>
        {Icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums",
          accent ? "text-brand-600" : "text-slate-950",
        )}
      >
        {value === null ? "—" : value}
      </p>
      {hint ? <p className="mt-2.5 text-xs leading-4 text-slate-500">{hint}</p> : null}
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

/**
 * A compact, scrollable table with a tinted header and row hover.
 *
 * The hover state lives on the row's cells rather than the `<tr>` because a
 * background on `<tr>` is painted under the cells and can be obscured by them
 * in some engines.
 */
export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-max border-collapse text-left [&_tbody>tr:hover>td]:bg-slate-50/70">
        {children}
      </table>
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
        "whitespace-nowrap border-b border-slate-100 px-4 py-2.5 text-[13px] text-slate-700 transition-colors",
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * Placeholder rows shown while the first page loads.
 *
 * These reserve the same height as real rows so the panel does not collapse
 * and then jump when data arrives — the layout shift is the complaint, not the
 * wait. `Skeleton` respects `prefers-reduced-motion`.
 */
export function SkeletonRows({ rows, columns }: { rows: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row}>
          {Array.from({ length: columns }, (_, column) => (
            <td key={column} className="border-b border-slate-100 px-4 py-2.5">
              <Skeleton
                className="h-4"
                // First column carries the primary label, so it is wider.
                style={{ width: column === 0 ? "65%" : "45%" }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyRow({
  colSpan,
  icon,
  children,
}: {
  colSpan: number;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const Icon = icon;

  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12">
        <div className="flex flex-col items-center justify-center text-center">
          {Icon ? (
            <span className="flex size-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-xs ring-1 ring-slate-200">
              <Icon className="size-5" aria-hidden />
            </span>
          ) : null}
          <p
            className={cn(
              "max-w-sm text-[13px] leading-6 text-slate-500",
              Icon ? "mt-3" : undefined,
            )}
          >
            {children}
          </p>
        </div>
      </td>
    </tr>
  );
}
