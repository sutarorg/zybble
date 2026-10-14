import { Flag } from "lucide-react";
import { getAdminReports } from "@/lib/server/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportPriorityBadge, ReportStatusBadge } from "@/components/admin/report-badge";
import { ResolveReportButton } from "./resolve-report-button";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const reports = await getAdminReports();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Reports</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {reports.length === 0
            ? "No reports have been filed."
            : `${reports.length} report${reports.length === 1 ? "" : "s"} from learners.`}
        </p>
      </header>

      {reports.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Nothing reported"
          description="Learners can flag courses and reviews. Reports appear here the moment one is filed."
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="rounded-xl border border-border bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReportStatusBadge status={report.status} />
                    <ReportPriorityBadge priority={report.priority} />
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                      {report.kind}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] font-semibold">{report.targetTitle}</p>
                  <p className="mt-1 text-[13px]">{report.reason}</p>
                  {report.detail ? (
                    <p className="mt-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
                      {report.detail}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[12px] text-zinc-400">
                    Reported by {report.reporterName} · {new Date(report.submittedAt).toLocaleString("en-IN")}
                  </p>
                  {report.adminNote ? (
                    <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[12.5px] text-sky-900">
                      <strong className="font-semibold">Internal note:</strong> {report.adminNote}
                    </p>
                  ) : null}
                </div>
                <ResolveReportButton reportId={report.id} status={report.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}