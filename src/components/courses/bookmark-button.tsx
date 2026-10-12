"use client";

import * as React from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/providers/app-providers";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  courseId,
  courseTitle,
  className,
}: {
  courseId: string;
  courseTitle?: string;
  className?: string;
}) {
  const { isWishlisted, toggleWishlist } = useApp();
  const saved = isWishlisted(courseId);

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggleWishlist(courseId);
        if (added) toast.success("Saved to your wishlist");
        else toast("Removed from wishlist");
      }}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-full border border-border/70 bg-white/95 shadow-sm backdrop-blur transition-all hover:scale-105 hover:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none active:scale-95",
        className
      )}
    >
      <Bookmark
        className={cn(
          "size-4 transition-colors",
          saved ? "fill-primary text-primary" : "text-zinc-600"
        )}
        aria-hidden
      />
    </button>
  );
}
