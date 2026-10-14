import { Settings2 } from "lucide-react";
import { requireCreator } from "@/lib/server/session";
import { CreatorSettingsForm } from "./creator-settings-form";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function CreatorSettingsPage() {
  const session = await requireCreator();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Studio settings</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Notification preferences for <span className="font-medium text-foreground">{session.email}</span>.
        </p>
      </header>

      <CreatorSettingsForm />

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
          <Settings2 className="size-4 text-primary" aria-hidden /> What Zybble does not let you change here
        </h2>
        <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground">
          <li>• Your commission rate is a marketplace setting applied at checkout, not a personal preference.</li>
          <li>• Settlement is handled by Razorpay Route; payout details live in the Razorpay dashboard.</li>
          <li>• Account status, role and email are managed from the account and admin portals.</li>
          <li>• Zybble publishes no refund policy, so there is nothing here to configure.</li>
        </ul>
      </section>
    </div>
  );
}