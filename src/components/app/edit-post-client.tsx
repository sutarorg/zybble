"use client";

import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { PostComposer } from "@/components/app/post-composer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiResource, useLinkedInAccounts, useUsage } from "@/lib/app/hooks";
import type { DashboardPost } from "@/lib/app/types";

/**
 * Edit shell for `/posts/[postId]/edit`.
 *
 * Loads the post from `/api/posts/[postId]` — which is RLS-scoped, so a post
 * from another workspace is a 404 here rather than a leaked record — and hands
 * it to the composer, which PATCHes the same route.
 */
export function EditPostClient({ postId }: { postId: string }) {
  const post = useApiResource<{ post: DashboardPost }>(`/api/posts/${postId}`);
  const accounts = useLinkedInAccounts();
  const usage = useUsage();

  if (post.loading || accounts.loading || usage.loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (post.error || post.data === null) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={FileQuestion}
          title="Post not found"
          description={
            post.error ??
            "This post doesn't exist in the active workspace, or it was deleted. It may belong to another workspace you're a member of — switch workspaces to edit it."
          }
        >
          <Button asChild>
            <Link href="/posts">Back to posts</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <PostComposer
      initialPost={post.data.post}
      accounts={accounts.data?.connections ?? []}
      remainingScheduleSlots={usage.data?.remaining ?? null}
    />
  );
}
