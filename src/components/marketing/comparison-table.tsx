import { Check, Minus } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

interface Row {
  label: string;
  free: string | boolean;
  pro: string | boolean;
}

const groups: { label: string; rows: Row[] }[] = [
  {
    label: "Publishing",
    rows: [
      { label: "Scheduled posts per month", free: "10", pro: "Unlimited" },
      { label: "Drafts", free: "Unlimited", pro: "Unlimited" },
      { label: "Content calendar", free: true, pro: true },
      { label: "Connected LinkedIn accounts", free: "1", pro: "5 per workspace" },
    ],
  },
  {
    label: "Analytics",
    rows: [
      { label: "Post performance history", free: "7 days", pro: "12 months" },
      { label: "Advanced engagement analytics", free: false, pro: true },
      { label: "Best-time-to-post insights", free: false, pro: true },
    ],
  },
  {
    label: "Workspace",
    rows: [
      { label: "Team collaboration", free: false, pro: true },
      { label: "Price", free: "$0 / month", pro: "$15 / seat / month" },
    ],
  },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true)
    return (
      <span className="inline-flex items-center gap-1.5 text-[15px] font-medium text-slate-700">
        <Check className="size-4 text-brand-600" aria-hidden />
        Included
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex items-center gap-1.5 text-[15px] text-slate-400">
        <Minus className="size-4" aria-hidden />
        Not included
      </span>
    );
  return <span className="text-[15px] font-medium text-slate-700">{value}</span>;
}

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-xs">
        <caption className="sr-only">
          Full feature comparison between the Free and Pro plans
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="w-1/2 border-b border-slate-200 bg-slate-50 px-6 py-4 text-left text-sm font-semibold text-slate-900"
            >
              Feature
            </th>
            <th
              scope="col"
              className="w-1/4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-left text-sm font-semibold text-slate-900"
            >
              Free
            </th>
            <th
              scope="col"
              className="w-1/4 border-b border-slate-200 bg-brand-50/60 px-6 py-4 text-left text-sm font-semibold text-brand-800"
            >
              Pro
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.label}>
              <tr>
                <th
                  scope="row"
                  colSpan={1}
                  className={cn(
                    "border-b border-slate-200 px-6 pb-2 pt-6 text-left text-xs font-semibold uppercase tracking-wider text-slate-400",
                  )}
                >
                  {group.label}
                </th>
                <td className="border-b border-slate-200" />
                <td className="border-b border-slate-200 bg-brand-50/30" />
              </tr>
              {group.rows.map((row, i) => (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className={cn(
                      "px-6 py-4 text-left text-[15px] font-normal text-slate-600",
                      i < group.rows.length - 1 ? "border-b border-slate-100" : "",
                    )}
                  >
                    {row.label}
                  </th>
                  <td
                    className={cn(
                      "px-6 py-4",
                      i < group.rows.length - 1 ? "border-b border-slate-100" : "",
                    )}
                  >
                    <Cell value={row.free} />
                  </td>
                  <td
                    className={cn(
                      "bg-brand-50/30 px-6 py-4",
                      i < group.rows.length - 1 ? "border-b border-slate-100" : "",
                    )}
                  >
                    <Cell value={row.pro} />
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
