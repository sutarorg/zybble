import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/server/session";
import { getLearnerPreferences } from "@/lib/server/learner";
import { LearnerSettingsClient } from "./learner-settings-client";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function LearnerSettingsPage() {
  const session = await requireSession();
  const preferences = await getLearnerPreferences();

  return (
    <LearnerSettingsClient
      accountEmail={session.email}
      accountName={session.fullName}
      emailVerified={session.emailVerified}
      avatarKey={session.avatarKey}
      preferences={preferences}
      shortcuts={[
        { href: "/orders", label: "Order history", text: "Receipts and real payments" },
        { href: "/help", label: "Help Center", text: "FAQs and support" },
      ]}
    />
  );
}