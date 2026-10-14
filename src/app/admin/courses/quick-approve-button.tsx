"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { approveCourse } from "@/app/admin/actions";
import { ActionButton } from "@/components/admin/action-button";

export function QuickApproveButton({ courseId, paid }: { courseId: string; paid: boolean }) {
  const router = useRouter();

  return (
    <ActionButton
      label="Approve"
      icon={CheckCircle2}
      confirmTitle="Approve and publish this course?"
      confirmBody={
        paid
          ? "Publishing makes this course purchasable. Razorpay Route will be asked to split every payment between the creator and Zybble."
          : "Publishing lists this free course in the public catalog."
      }
      confirmLabel="Approve and publish"
      toastText="Course approved and published"
      onAction={async (reason) => {
        const result = await approveCourse({ courseId, reason: reason || undefined });
        if (result.ok) router.refresh();
        return result;
      }}
    />
  );
}