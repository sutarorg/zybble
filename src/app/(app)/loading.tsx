import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant feedback for marketplace navigation.
 *
 * Public routes read from Supabase, so a click otherwise waits on a network
 * round trip before anything appears. This boundary lets Next paint the shell
 * the moment the link is clicked and stream the page into it. The layout below
 * mirrors the real page's rhythm, so the content settles without a jump.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 sm:py-8 lg:px-10">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-5 h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />

      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
