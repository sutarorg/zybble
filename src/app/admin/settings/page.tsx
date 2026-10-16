import { Settings2, Info } from "lucide-react";
import { getAdminSettings, getAdminAuditLog } from "@/lib/server/admin";
import { formatCommissionPercent } from "@/lib/money";
import { MarketplaceSettingsForm } from "./marketplace-settings-form";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [settings, audit] = await Promise.all([getAdminSettings(), getAdminAuditLog()]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Marketplace settings</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Changes take effect for new checkouts. Commission is snapshotted onto every order item at purchase time,
          so existing orders keep the rate they were placed with.
        </p>
      </header>

      <MarketplaceSettingsForm settings={settings} />

      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3.5 text-[13px]">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-700" aria-hidden />
        <div className="text-sky-900">
          <p className="font-medium">Open legal and accounting questions</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sky-800">
            <li>
              GST treatment of course fees is <strong>undecided</strong>. Zybble does not collect, declare or
              display any tax, and no tax line item exists in the order schema.
            </li>
            <li>
              The {formatCommissionPercent(settings.commissionBps)}% commission is a <strong>planned default
              only</strong>, pending approval of launch terms. It is a server setting, not a hard-coded constant.
            </li>
            <li>
              Razorpay settlement fees are absorbed by whichever party the final agreement names. Zybble does not
              deduct or display them today.
            </li>
            <li>
              Money leaves the platform only through a reviewed creator payout. There is no customer-facing money
              reversal flow in this portal.
            </li>
          </ul>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
          <Settings2 className="size-4 text-primary" aria-hidden /> Audit log
        </h2>
        {audit.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            No administrative actions have been recorded yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {audit.map((entry) => (
              <li key={String(entry.id)} className="py-2.5 text-[13px]">
                <p>
                  <span className="font-mono text-[12px] text-primary">{String(entry.action)}</span>{" "}
                  <span className="text-muted-foreground">
                    on {String(entry.target_type)} {String(entry.target_id)}
                  </span>
                </p>
                <p className="mt-0.5 text-[11.5px] text-zinc-400">
                  {String(entry.actor_email ?? "system")} · {new Date(String(entry.created_at)).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}