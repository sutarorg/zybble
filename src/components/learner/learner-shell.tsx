import * as React from "react";
import { LearnerSidebar } from "@/components/learner/learner-sidebar";
import { LearnerHeader } from "@/components/learner/learner-header";
import { Footer } from "@/components/layout/footer";
import { getCertificates, getEnrollments, getNotifications, getWishlist } from "@/lib/server/learner";

/**
 * Learner dashboard chrome — same visual language as the public Explore shell:
 * fixed sidebar, sticky header with global search, light surfaces.
 *
 * Authorization already happened on the server in the route-group layout; this
 * wrapper only loads the real counters the sidebar shows.
 */
export async function LearnerShell({ children }: { children: React.ReactNode }) {
  const [enrollments, wishlist, certificates, notifications] = await Promise.all([
    getEnrollments(),
    getWishlist(),
    getCertificates(),
    getNotifications(),
  ]);

  return (
    <div className="min-h-dvh bg-white">
      <LearnerSidebar
        counts={{
          enrollmentCount: enrollments.length,
          wishlistCount: wishlist.length,
          certificateCount: certificates.length,
        }}
      />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <LearnerHeader notifications={notifications} />
        <main className="min-w-0 flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}