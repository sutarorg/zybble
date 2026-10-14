"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { moderateReview } from "@/app/admin/actions";
import { ActionButton } from "@/components/admin/action-button";

export function ModerateReviewButton({ reviewId, published }: { reviewId: string; published: boolean }) {
  const router = useRouter();

  return published ? (
    <ActionButton
      label="Hide"
      danger
      confirmTitle="Hide this review?"
      confirmBody="The review stops appearing on the course page but stays in the database for audit."
      confirmLabel="Hide review"
      toastText="Review hidden"
      onAction={async () => {
        const result = await moderateReview(reviewId, false);
        if (result.ok) router.refresh();
        return result;
      }}
    />
  ) : (
    <ActionButton
      label="Publish"
      confirmTitle="Publish this review?"
      confirmBody="It becomes visible on the course page immediately."
      confirmLabel="Publish review"
      toastText="Review published"
      onAction={async () => {
        const result = await moderateReview(reviewId, true);
        if (result.ok) router.refresh();
        return result;
      }}
    />
  );
}