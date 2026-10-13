"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  CornerUpLeft,
  Eye,
  Flag,
  Star,
  UserRound,
  XCircle,
} from "lucide-react";
import type { AdminReport, ReportStatus } from "@/types";
import { useAdmin } from "@/components/providers/admin-provider";
import { formatDate, timeAgo } from "@/lib/format";
import { AdminDrawer } from "@/components/admin/admin-drawer";
import { ReportPriorityBadge, ReportStatusBadge } from "@/components/admin/report-badge";
import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPE_META = {
  course: { label: "Course", icon: BookOpen },
  review: { label: "Review", icon: Star },
  user: { label: "User", icon: UserRound },
} as const;

export default function AdminReportsPage() {
  const translateUi = useTranslate();
  const { hydrated, reports, setReport } = useAdmin();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("open");
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: reports.length };
    for (const r of reports) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [reports]);

  const filtered = useMemo(() => {
    let list = [...reports].sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt));
    if (statusFilter === "all") return list;
    return list.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  const openReport = (r: AdminReport) => {
    setSelected(r);
    setAdminNote(r.adminNote ?? "");
  };

  const tabs: { id: ReportStatus | "all"; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "under_review", label: "Under Review" },
    { id: "resolved", label: "Resolved" },
    { id: "dismissed", label: "Dismissed" },
    { id: "all", label: "All" },
  ];

  if (!hydrated) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Trust & Safety"} /></p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Reports"} /></h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground"><LocalizedText text={"Flagged courses, reviews and users. Work through the queue: triage, resolve or dismiss — each action confirms first and updates local mock state."} /></p>
      </div>

      {/* Status tabs */}
      <div className="flex snap-x gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label={translateUi("Report status")}>
        {tabs.map((t) => {
          const active = statusFilter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatusFilter(t.id)}
              className={cn(
                "flex h-8.5 shrink-0 cursor-pointer snap-start items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium whitespace-nowrap transition-all",
                active ? "border-primary bg-primary text-white shadow-sm" : "border-border bg-white text-muted-foreground hover:border-zinc-300 hover:text-foreground"
              )}
            >
              <LocalizedText text={t.label} />
              <span className={cn("rounded px-1 text-[10.5px] tabular-nums", active ? "bg-white/20" : "bg-muted")}>
                {counts[t.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Flag}
          title={statusFilter === "open" ? "Queue is clear" : "No reports here"}
          description={
            statusFilter === "open"
              ? "No open reports right now. New flags from learners land here."
              : "Try a different status tab."
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((report) => {
            const meta = TYPE_META[report.type];
            return (
              <li key={report.id} className="rounded-xl border border-border bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-zinc-500">
                      <meta.icon className="size-4.5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{meta.label}</Badge>
                        <ReportPriorityBadge priority={report.priority} />
                        <ReportStatusBadge status={report.status} />
                      </div>
                      <h2 className="mt-2 text-[14.5px] font-semibold"><LocalizedText text={report.targetTitle} /></h2>
                      {report.targetExcerpt && (
                        <p className="mt-1 line-clamp-2 max-w-2xl rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-[12px] text-muted-foreground italic">
                          “<LocalizedText text={report.targetExcerpt} />”
                        </p>
                      )}
                      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground"><LocalizedText text={report.reason} /></p>
                      <p className="mt-1.5 text-[11.5px] text-zinc-400"><LocalizedText text={"Reported by"} /><LocalizedText text={report.reporterName} /> · <LocalizedText text={timeAgo(report.submittedAt)} />
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {(report.status === "open" || report.status === "under_review") && (
                      <>
                        <ActionButton
                          label={translateUi("Resolve")}
                          icon={CheckCircle2}
                          size="sm"
                          confirmTitle={`Resolve report on “${report.targetTitle}”?`}
                          confirmBody="The report is marked resolved in the local queue. Add an admin note inside the detail view first if relevant."
                          confirmLabel="Resolve report"
                          onAction={() => setReport(report.id, { status: "resolved" })}
                          toastText="Report resolved (simulated)"
                        />
                        <ActionButton
                          label={translateUi("Dismiss")}
                          icon={XCircle}
                          variant="outline"
                          danger
                          size="sm"
                          confirmTitle="Dismiss this report?"
                          confirmBody="Dismissed reports stay in history with their status."
                          confirmLabel="Dismiss report"
                          onAction={() => setReport(report.id, { status: "dismissed" })}
                          toastText="Report dismissed (simulated)"
                        />
                      </>
                    )}
                    {(report.status === "resolved" || report.status === "dismissed") && (
                      <ActionButton
                        label={translateUi("Reopen")}
                        icon={CornerUpLeft}
                        variant="outline"
                        size="sm"
                        confirmTitle="Reopen this report?"
                        confirmBody="It moves back to the open queue for another pass."
                        confirmLabel="Reopen"
                        onAction={() => setReport(report.id, { status: "open" })}
                        toastText="Report reopened (simulated)"
                      />
                    )}
                    <Button variant="outline" size="sm" onClick={() => openReport(report)}>
                      <Eye aria-hidden /><LocalizedText text={"Details"} /></Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Detail drawer */}
      <AdminDrawer
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
          else if (selected && selected.status === "open") setReport(selected.id, { status: "under_review" });
        }}
        title={translateUi(selected ? `Report — ${selected.targetTitle}` : "")}
        description={selected ? `${TYPE_META[selected.type].label} report · submitted ${formatDate(selected.submittedAt)}` : undefined}
        footer={
          selected && (
            <div className="flex flex-wrap gap-2">
              <ActionButton
                label={translateUi("Resolve with note")}
                icon={CheckCircle2}
                size="sm"
                confirmTitle="Resolve this report?"
                confirmBody="Your admin note is attached to the resolution in the local state."
                confirmLabel="Resolve report"
                onAction={() => {
                  setReport(selected.id, { status: "resolved", adminNote: adminNote.trim() || undefined });
                  setSelected(null);
                }}
                toastText="Report resolved with note (simulated)"
              />
              <ActionButton
                label={translateUi("Dismiss")}
                icon={XCircle}
                variant="outline"
                danger
                size="sm"
                confirmTitle="Dismiss this report?"
                confirmBody="It stays in history as dismissed."
                confirmLabel="Dismiss"
                onAction={() => {
                  setReport(selected.id, { status: "dismissed", adminNote: adminNote.trim() || undefined });
                  setSelected(null);
                }}
                toastText="Report dismissed (simulated)"
              />
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <ReportStatusBadge status={selected.status} />
              <ReportPriorityBadge priority={selected.priority} />
              <Badge variant="secondary">{TYPE_META[selected.type].label}</Badge>
            </div>
            <section>
              <h3 className="text-[12px] font-semibold tracking-wide text-zinc-400 uppercase"><LocalizedText text={"Reporter's claim"} /></h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed"><LocalizedText text={selected.reason} /></p>
              <p className="mt-1 text-[12px] text-muted-foreground">— <LocalizedText text={selected.reporterName} /></p>
            </section>
            {selected.targetExcerpt && (
              <section>
                <h3 className="text-[12px] font-semibold tracking-wide text-zinc-400 uppercase"><LocalizedText text={"Reported content"} /></h3>
                <p className="mt-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground italic">
                  “<LocalizedText text={selected.targetExcerpt} />”
                </p>
              </section>
            )}
            <section>
              <h3 className="text-[12px] font-semibold tracking-wide text-zinc-400 uppercase"><LocalizedText text={"Related"} /></h3>
              <div className="mt-2">
                {selected.type === "course" && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/courses/${selected.targetId}`}><LocalizedText text={"Open in moderation"} /></Link>
                  </Button>
                )}
                {selected.type === "review" && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/reviews"><LocalizedText text={"Open review moderation"} /></Link>
                  </Button>
                )}
                {selected.type === "user" && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/users?selected=${selected.targetId}`}><LocalizedText text={"Open user profile"} /></Link>
                  </Button>
                )}
              </div>
            </section>
            <section>
              <label htmlFor="admin-note" className="text-[12px] font-semibold tracking-wide text-zinc-400 uppercase"><LocalizedText text={"Admin note"} /></label>
              <Textarea
                id="admin-note"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={translateUi("What did you find, and why did you resolve it this way?")}
                className="mt-2 min-h-24 text-[13px]"
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setReport(selected.id, { adminNote: adminNote.trim() || undefined });
                  toast.success("Admin note saved (local)");
                }}
              ><LocalizedText text={"Save note"} /></Button>
            </section>
          </div>
        )}
      </AdminDrawer>
    </div>
  );
}
