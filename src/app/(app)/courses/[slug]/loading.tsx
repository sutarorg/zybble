import { Skeleton } from "@/components/ui/skeleton";

/** Course detail: hero, then the curriculum and the sticky enroll card. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 sm:py-8 lg:px-10">
      <Skeleton className="h-4 w-48" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="aspect-video w-full rounded-xl" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
        <div className="hidden lg:block">
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
