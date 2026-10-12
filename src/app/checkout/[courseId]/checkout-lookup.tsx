"use client";

import { notFound } from "next/navigation";
import { useCreator } from "@/components/providers/creator-provider";
import { CheckoutClient } from "./checkout-client";
import { Skeleton } from "@/components/ui/skeleton";

/** Resolves checkout for courses published locally via the creator studio. */
export function CheckoutLookup({ courseId }: { courseId: string }) {
  const { communityCourses, hydrated } = useCreator();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-busy>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }

  const course = communityCourses.find((c) => c.id === courseId);
  if (!course) notFound();

  return <CheckoutClient course={course} />;
}
