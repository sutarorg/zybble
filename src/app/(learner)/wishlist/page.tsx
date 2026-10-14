import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { getWishlist } from "@/lib/server/learner";
import { formatInr } from "@/lib/money";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/courses/bookmark-button";
import { imagePath } from "@/lib/image-path";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Courses you saved for later.",
};

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const wishlist = await getWishlist();

  return (
    <div className="space-y-6 px-4 py-7 sm:px-6 lg:px-9">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Wishlist</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {wishlist.length === 0
            ? "Courses you bookmark are saved to your account."
            : `${wishlist.length} saved course${wishlist.length === 1 ? "" : "s"}`}
        </p>
      </header>

      {wishlist.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Your wishlist is empty"
          description="Tap the bookmark on any course to save it here. Your wishlist is tied to your Zybble account, not your browser."
          action={
            <Button asChild>
              <Link href="/explore">Browse the catalog</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {wishlist.map((course) => (
            <li key={course.id} className="flex flex-col rounded-xl border border-border bg-white p-3.5 shadow-card">
              {course.thumbnailKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePath("thumbnails", course.thumbnailKey)}
                  alt=""
                  className="mb-3 h-32 w-full rounded-lg object-cover"
                />
              ) : (
                <div className="mb-3 flex h-32 items-center justify-center rounded-lg bg-muted text-zinc-400">
                  <Bookmark className="size-5" aria-hidden />
                </div>
              )}
              <Link href={`/courses/${course.slug}`} className="line-clamp-2 text-[14px] font-semibold hover:underline">
                {course.title}
              </Link>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {course.creatorName} · {course.lessonsCount} lessons
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <span className="text-[14px] font-semibold tabular-nums">
                  {course.pricePaise === 0 ? "Free" : formatInr(course.pricePaise)}
                </span>
                <BookmarkButton courseId={course.id} initialBookmarked={true} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}