"use client";

import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { PostComposer } from "@/components/app/post-composer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientMounted, useLocalPosts } from "@/lib/app/hooks";

export function EditPostClient({ postId }: { postId: string }) {
  const posts = useLocalPosts();
  const mounted = useClientMounted();
  const post = posts.find((p) => p.id === postId);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={FileQuestion}
          title="Post not found"
          description="This post isn't in your local preview store — it may have been deleted, or it was created on another device. Server-synced posts arrive with the backend."
        >
          <Button asChild>
            <Link href="/posts">Back to posts</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  return <PostComposer initialPost={post} />;
}
