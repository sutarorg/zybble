import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireCreator } from "@/lib/server/session";
import { getCreatorStudioPreferences } from "@/lib/server/creator";
import { CreatorSettingsForm } from "./creator-settings-form";

export const metadata = { title: "Studio settings" };
export const dynamic = "force-dynamic";

/**
 * Studio settings.
 *
 * Only studio concerns live here — which events reach the creator, and the
 * defaults prefilled when they start a course. Everything a *learner* configures
 * (daily goal, catalog email, interface language, account) stays on `/settings`,
 * and this page links there rather than duplicating it: two pages writing the
 * same preference is how a toggle starts lying.
 */
export default async function CreatorSettingsPage() {
  const session = await requireCreator();
  const preferences = await getCreatorStudioPreferences();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Creator Studio</p>
        <h1 className="font-display mt-1.5 text-[26px] leading-tight font-bold tracking-tight">Studio settings</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Alerts for <span className="font-medium text-foreground">{session.email}</span> and the defaults Zybble
          prefills when you start a new course.
        </p>
      </header>

      <CreatorSettingsForm preferences={preferences} />

      <section className="rounded-2xl border border-border bg-white p-2 shadow-card">
        <Link
          href="/settings"
          className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted"
        >
          <span>
            <span className="block text-[13.5px] font-medium">Learner settings</span>
            <span className="block text-[12px] text-muted-foreground">
              Daily goal, catalog email, interface language, profile photo and your account
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-zinc-300" aria-hidden />
        </Link>
        <Link
          href="/creator/payouts"
          className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted"
        >
          <span>
            <span className="block text-[13.5px] font-medium">Payout destination</span>
            <span className="block text-[12px] text-muted-foreground">
              Encrypted UPI ID or Indian bank account, and payout requests
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-zinc-300" aria-hidden />
        </Link>
        <Link
          href="/creator/profile"
          className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted"
        >
          <span>
            <span className="block text-[13.5px] font-medium">Public instructor profile</span>
            <span className="block text-[12px] text-muted-foreground">
              Username, photo, headline, bio and the topics you teach
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-zinc-300" aria-hidden />
        </Link>
      </section>


    </div>
  );
}
