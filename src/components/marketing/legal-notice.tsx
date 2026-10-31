import { FileWarning } from "lucide-react";

/**
 * Visible marker that legal copy is a good-faith template pending review by
 * the business owner — required so no legal assurance is ever implied before
 * company-specific details are confirmed.
 */
export function LegalNotice() {
  return (
    <div
      role="note"
      className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
    >
      <p className="flex items-start gap-3 text-sm leading-6 text-amber-900">
        <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">Pending owner review.</strong> This
          document is a carefully drafted template. Details marked{" "}
          <span className="rounded bg-amber-100 px-1 font-mono text-[13px]">
            [owner to confirm]
          </span>{" "}
          must be reviewed and completed by Zybble&rsquo;s legal owner before this
          page is treated as binding.
        </span>
      </p>
    </div>
  );
}
