"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, EyeOff, MessageSquareWarning, XCircle } from "lucide-react";
import {
  approveCourse,
  rejectCourse,
  requestCourseChanges,
  unpublishCourse,
} from "@/app/admin/actions";
import { ActionButton } from "@/components/admin/action-button";

/**
 * Moderation decisions.
 *
 * Each button calls a server action that verifies the admin role, re-reads the
 * course, and — for a paid course — checks Razorpay's live Route status before
 * allowing publication.
 */
export function CourseDecisionBar({
  courseId,
  status,
  paid,
  settleable,
  hasLessons,
}: {
  courseId: string;
  status: string;
  paid: boolean;
  settleable: boolean;
  hasLessons: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const published = status === "published";
  const reviewable = ["pending", "draft", "changes_requested", "rejected"].includes(status);

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-card">
      {published ? (
        <ActionButton
          label="Unpublish"
          icon={EyeOff}
          danger
          confirmTitle="Remove this course from the public catalog?"
          confirmBody="Existing buyers keep their access. The course stops appearing in Explore and category pages until you publish it again."
          confirmLabel="Unpublish"
          toastText="Course unpublished"
          onAction={async (reason) => {
            const result = await unpublishCourse(courseId);
            if (result.ok) refresh();
            return { ...result, message: reason ? `${result.message} Note: ${reason}` : result.message };
          }}
        />
      ) : reviewable ? (
        <>
          <ActionButton
            label="Approve & publish"
            icon={CheckCircle2}
            variant="default"
            disabled={!hasLessons}
            confirmTitle="Approve and publish this course?"
            confirmBody={
              paid
                ? "Learners can now buy this course in INR via Razorpay Checkout. The creator's share after Zybble's commission accrues to their ledger balance for manual payout."
                : "This free course becomes visible in the public catalog."
            }
            confirmLabel="Approve and publish"
            toastText="Course approved and published"
            onAction={async (reason) => {
              const result = await approveCourse({ courseId, reason: reason || undefined });
              if (result.ok) refresh();
              return result;
            }}
          />
          <ActionButton
            label="Request changes"
            icon={MessageSquareWarning}
            confirmTitle="Send this course back to the creator?"
            confirmBody="Your note is shown to the creator and emailed to them. Be specific about what has to change."
            confirmLabel="Request changes"
            reasonLabel="What needs to change?"
            minReasonLength={10}
            toastText="Changes requested"
            onAction={async (reason) => {
              const result = await requestCourseChanges({ courseId, reason });
              if (result.ok) refresh();
              return result;
            }}
          />
          <ActionButton
            label="Reject"
            icon={XCircle}
            danger
            confirmTitle="Reject this submission?"
            confirmBody="The creator is told why. Rejection is a moderation decision and is recorded in the audit log."
            confirmLabel="Reject course"
            reasonLabel="Reason for rejection"
            minReasonLength={10}
            toastText="Course rejected"
            onAction={async (reason) => {
              const result = await rejectCourse({ courseId, reason });
              if (result.ok) refresh();
              return result;
            }}
          />
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          This course is <strong>{status}</strong>; no moderation action applies right now.
        </p>
      )}

      {!hasLessons ? <p className="text-[12.5px] text-amber-700">Add at least one lesson first.</p> : null}
    </section>
  );
}