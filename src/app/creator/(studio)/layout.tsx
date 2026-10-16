import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getCreatorCourses, getCreatorNotifications } from "@/lib/server/creator";
import { CreatorStudioProvider, type StudioNotification } from "@/components/providers/creator-studio-context";
import { CreatorShell } from "@/components/creator/creator-shell";

/**
 * The creator workspace.
 *
 * Role is verified on the server against the `profiles` row before any studio
 * chrome or data is rendered, and every studio query is scoped to the signed-in
 * creator. `/creator/signup` deliberately lives outside this route group so a
 * learner can reach onboarding without already holding the creator role.
 */
export default async function CreatorStudioLayout({ children }: { children: ReactNode }) {
  // A missing role is a *navigation* outcome, not a server exception: throwing
  // here rendered the framework 500 page instead of letting the visitor do
  // something about it. Send each case somewhere useful instead.
  const session = await getSession();
  if (!session) redirect("/login?next=/creator");
  if (session.status !== "active") redirect("/login");
  // Signed in but not yet a creator — onboarding is one click away.
  if (!session.creator) redirect("/creator/signup");

  const [notifications, courses] = await Promise.all([getCreatorNotifications(), getCreatorCourses()]);

  const displayName = session.creator?.displayName ?? session.fullName;
  const initials = session.initials || "C";

  const pendingCount = courses.filter(
    (course) => course.status === "pending" || course.status === "changes_requested"
  ).length;

  const value = {
    displayName,
    initials,
    pendingCount,
    notifications: notifications.map(
      (notification): StudioNotification => ({
        id: notification.id,
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        href: notification.href,
        read: notification.read,
        createdAt: notification.createdAt,
      })
    ),
  };

  return (
    <CreatorStudioProvider value={value}>
      <CreatorShell>{children}</CreatorShell>
    </CreatorStudioProvider>
  );
}