"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { toggleWishlist } from "@/app/(learner)/actions";
import { useApp } from "@/components/providers/app-providers";
import { cn } from "@/lib/utils";

/**
 * Wishlist toggle.
 *
 * The browser never stores the wishlist: the server action writes the row under
 * the caller's own user id, and RLS prevents anyone else touching it.
 */
export function BookmarkButton({
  courseId,
  initialBookmarked,
  className,
}: {
  courseId: string;
  /** Rendered state comes from the server so the icon matches the database. */
  initialBookmarked: boolean;
  className?: string;
}) {
  const { session } = useApp();
  const router = useRouter();
  const [saved, setSaved] = React.useState(initialBookmarked);
  const [busy, setBusy] = React.useState(false);

  return (
    <button
      type="button"
      disabled={busy || !session}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      title={session ? undefined : "Sign in to save courses"}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setBusy(true);
        const result = await toggleWishlist(courseId).then(
          (value) => value,
          () => ({ ok: false, error: "Could not update your wishlist" })
        );
        setBusy(false);
        if (!result.ok) {
          toast.error(result.error ?? "Could not update your wishlist");
          return;
        }
        setSaved(!saved);
        toast.success(saved ? "Removed from wishlist" : "Saved to your wishlist");
        router.refresh();
      }}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-full border border-border/70 bg-white/95 shadow-sm backdrop-blur transition-all hover:scale-105 hover:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      <Bookmark
        className={cn("size-4 transition-colors", saved ? "fill-primary text-primary" : "text-zinc-600")}
        aria-hidden
      />
    </button>
  );
}