"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import { resolveReport } from "@/app/admin/actions";
import { ActionButton } from "@/components/admin/action-button";

export function ResolveReportButton({ reportId, status }: { reportId: string; status: string }) {
  const router = useRouter();
  const closed = status === "resolved" || status === "dismissed";

  if (closed) {
    return <span className="shrink-0 text-[12.5px] text-zinc-400">Closed</span>;
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <ActionButton
        label="Resolve"
        icon={CheckCircle2}
        confirmTitle="Resolve this report?"
        confirmBody="Record what action you took. The note stays internal and is stored with the report."
        confirmLabel="Resolve report"
        reasonLabel="Internal note"
        toastText="Report resolved"
        onAction={async (note) => {
          const result = await resolveReport(reportId, "resolved", note);
          if (result.ok) router.refresh();
          return result;
        }}
      />
      <ActionButton
        label="Dismiss"
        icon={XCircle}
        danger
        confirmTitle="Dismiss this report?"
        confirmBody="Use this when the report does not describe a marketplace problem."
        confirmLabel="Dismiss report"
        reasonLabel="Internal note"
        toastText="Report dismissed"
        onAction={async (note) => {
          const result = await resolveReport(reportId, "dismissed", note);
          if (result.ok) router.refresh();
          return result;
        }}
      />
    </div>
  );
}