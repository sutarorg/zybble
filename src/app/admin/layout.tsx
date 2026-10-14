import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminStudioProvider } from "@/components/providers/admin-studio-context";
import { getSession } from "@/lib/server/session";
import { getAdminNotifications, getAdminOverview, getAdminReports } from "@/lib/server/admin";

export const metadata: Metadata = {
  title: {
    default: "Admin Portal",
    template: "%s · Zybble Admin",
  },
  description: "Zybble marketplace operations.",
};

/**
 * Administrative routes are gated **on the server**.
 *
 * Hiding a sidebar link or redirecting from React is a usability affordance, not
 * a security control; the role is verified here against the `profiles` row and
 * again inside every admin action and query.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/login?next=/admin");
  if (session.status !== "active") redirect("/login");
  if (session.role !== "admin" && session.role !== "moderator") redirect("/dashboard");

  const [overview, reports, notifications] = await Promise.all([
    getAdminOverview(),
    getAdminReports(),
    getAdminNotifications(),
  ]);

  return (
    <AdminStudioProvider
      value={{
        adminName: session.fullName,
        pendingReviewCount: overview.pendingCourses,
        openReportCount: reports.filter((report) => report.status === "open" || report.status === "under_review").length,
        notifications: notifications.map((notification) => ({
          id: notification.id,
          kind: notification.kind,
          title: notification.title,
          body: notification.body,
          href: notification.href,
          read: notification.read,
          createdAt: notification.createdAt,
        })),
      }}
    >
      <AdminShell>{children}</AdminShell>
    </AdminStudioProvider>
  );
}
