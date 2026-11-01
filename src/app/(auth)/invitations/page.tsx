import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInvitation } from "./accept-invitation";

export const metadata: Metadata = {
  title: "Accept an invitation",
  description: "Accept an invitation to join a Zybble workspace.",
};

/**
 * `useSearchParams` needs a Suspense boundary above it, so the client component
 * is wrapped rather than rendered directly.
 */
export default function InvitationsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-white p-7 shadow-soft ring-1 ring-slate-200">
          <p className="text-center text-[15px] text-slate-600">Loading your invitation…</p>
        </div>
      }
    >
      <AcceptInvitation />
    </Suspense>
  );
}
