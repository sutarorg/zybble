import { Skeleton } from "@/components/ui/skeleton";

/** Learner area: page heading, then stat cards and a list. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-7 sm:px-6 sm:py-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-80" />

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>

      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
