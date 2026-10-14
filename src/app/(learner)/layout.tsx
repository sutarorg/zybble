import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LearnerShell } from "@/components/learner/learner-shell";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = {
  title: {
    default: "My Learning",
    template: "%s · Zybble",
  },
};

/**
 * Learner area.
 *
 * A verified session is required on the server. The shell's client-side check is
 * only a rendering convenience — every learner query additionally relies on RLS
 * scoped to the caller's own user id.
 */
export default async function LearnerLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");
  if (session.status !== "active") redirect("/login");

  return <LearnerShell>{children}</LearnerShell>;
}