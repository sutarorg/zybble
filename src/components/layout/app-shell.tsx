import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PublicChatbot } from "@/components/layout/public-chatbot";
import { getEnrollments, getNotifications } from "@/lib/server/learner";

/**
 * The shared public shell: fixed sidebar + sticky header + content + footer.
 * Used by all marketplace routes in the (app) route group.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const [notifications, enrollments] = await Promise.all([getNotifications(), getEnrollments()]);
  const enrollmentCount = enrollments.length;
  return (
    <div className="min-h-dvh bg-white">
      <Sidebar enrollmentCount={enrollmentCount} />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <Header notifications={notifications} />
        <main className="min-w-0 flex-1">{children}</main>
        <Footer />
      </div>
      <PublicChatbot />
    </div>
  );
}
