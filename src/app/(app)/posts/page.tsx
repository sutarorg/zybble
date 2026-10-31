"use client";

import { format, isPast } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  PenSquare,
  RotateCcw,
  Save,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectLinkedInDialog } from "@/components/app/connect-linkedin-dialog";
import { apiDelete, apiPost, errorMessage } from "@/lib/api/client";
import { usePosts } from "@/lib/app/hooks";
import type { DashboardPost } from "@/lib/app/types";
import { cn } from "@/lib/utils";

/**
 * Posts list.
 *
 * Reads `/api/posts` per status (RLS-scoped) and deletes through
 * `DELETE /api/posts/[id]`, which the server refuses for anything other than a
 * draft or a scheduled post — so published history cannot be erased here.
 * Retrying a failed post re-enqueues one Inngest run; it never duplicates a
 * post that actually reached LinkedIn.
 */

const STATUS_TONE: Record<DashboardPost["status"], string> = {
  draft: "bg-slate-100 text-slate-500 ring-slate-200",
  scheduled: "bg-brand-50 text-brand-600 ring-brand-100",
  publishing: "bg-blue-50 text-blue-600 ring-blue-100",
  published: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  failed: "bg-red-50 text-red-600 ring-red-100",
  cancelled: "bg-slate-100 text-slate-400 ring-slate-200",
};

const STATUS_LABEL: Record<DashboardPost["status"], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

function PostRow({
  post,
  onDelete,
  onRetry,
  busy,
}: {
  post: DashboardPost;
  onDelete: (post: DashboardPost) => void;
  onRetry: (post: DashboardPost) => void;
  busy: boolean;
}) {
  const overdue =
    post.status === "scheduled" && post.scheduledAt !== null && isPast(new Date(post.scheduledAt));

  const icon =
    post.status === "scheduled" ? (
      <CalendarClock className="size-4" aria-hidden />
    ) : post.status === "failed" ? (
      <XCircle className="size-4" aria-hidden />
    ) : post.status === "published" ? (
      <Send className="size-4" aria-hidden />
    ) : (
      <Save className="size-4" aria-hidden />
    );

  return (
    <li className="flex items-start gap-4 rounded-xl bg-white p-4 ring-1 ring-slate-200 transition-shadow hover:shadow-xs">
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1",
          STATUS_TONE[post.status],
        )}
      >
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <Link
          href={`/posts/${post.id}/edit`}
          className="block rounded-sm focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <p className="truncate text-sm font-medium text-slate-900">
            {post.text || "Untitled post"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-slate-500">
            {post.status === "scheduled" && post.scheduledAt ? (
              <span className={cn(overdue && "font-medium text-amber-600")}>
                {format(new Date(post.scheduledAt), "EEE d MMM · HH:mm")}
                {post.timezone ? ` ${post.timezone}` : ""}
                {overdue ? " — past slot, dispatcher will pick it up" : ""}
              </span>
            ) : post.status === "published" && post.publishedAt ? (
              <span>Published {format(new Date(post.publishedAt), "d MMM · HH:mm")}</span>
            ) : post.status === "failed" ? (
              <span className="font-medium text-red-600">
                {post.failureReason ?? "Publishing failed"}
              </span>
            ) : (
              <span>Draft · edited {format(new Date(post.updatedAt), "d MMM HH:mm")}</span>
            )}
            {post.media.length > 0 && (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <ImageIcon className="size-3.5" aria-hidden />
                {post.media.length}
              </span>
            )}
          </p>
        </Link>
      </div>

      <Badge variant="neutral" className="hidden sm:inline-flex">
        {STATUS_LABEL[post.status]}
      </Badge>

      {post.status === "published" && post.permalink && (
        <a
          href={post.permalink}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Open on LinkedIn"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for "${post.text.slice(0, 40) || "untitled post"}"`}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MoreHorizontal className="size-4" aria-hidden />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/posts/${post.id}/edit`}>
              <PenSquare aria-hidden />
              Edit
            </Link>
          </DropdownMenuItem>
          {post.status === "failed" && (
            <DropdownMenuItem onSelect={() => onRetry(post)}>
              <RotateCcw aria-hidden />
              Retry publishing
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={post.status === "published" || post.status === "publishing"}
            onSelect={() => onDelete(post)}
          >
            <Trash2 aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export default function PostsPage() {
  const scheduled = usePosts({ status: "scheduled", limit: 100 });
  const drafts = usePosts({ status: "draft", limit: 100 });
  const published = usePosts({ status: "published", limit: 50 });
  const failed = usePosts({ status: "failed", limit: 50 });

  const [pendingDelete, setPendingDelete] = useState<DashboardPost | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const scheduledPosts = scheduled.data ?? [];
  const draftPosts = drafts.data ?? [];
  const publishedPosts = published.data ?? [];
  const failedPosts = failed.data ?? [];
  const loading = scheduled.loading || drafts.loading || published.loading || failed.loading;

  async function remove(post: DashboardPost) {
    setBusyId(post.id);
    setActionError(null);
    try {
      await apiDelete(`/api/posts/${post.id}`);
      scheduled.reload();
      drafts.reload();
      published.reload();
      failed.reload();
    } catch (error) {
      setActionError(errorMessage(error, "Could not delete this post."));
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  }

  async function retry(post: DashboardPost) {
    setBusyId(post.id);
    setActionError(null);
    try {
      await apiPost(`/api/posts/${post.id}/retry`, {});
      failed.reload();
      scheduled.reload();
      published.reload();
    } catch (error) {
      setActionError(errorMessage(error, "Could not queue a retry."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Your drafts, queue and published history — stored in your workspace, published through the
          LinkedIn API.
        </p>
        <Button asChild size="sm">
          <Link href="/posts/new">
            <PenSquare aria-hidden />
            New post
          </Link>
        </Button>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 ring-1 ring-red-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {actionError}
        </p>
      )}

      <Tabs defaultValue="scheduled" className="mt-6">
        <TabsList>
          <TabsTrigger value="scheduled">
            Scheduled
            <span className="ml-1 text-xs tabular-nums text-slate-400">
              {scheduledPosts.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts
            <span className="ml-1 text-xs tabular-nums text-slate-400">{draftPosts.length}</span>
          </TabsTrigger>
          <TabsTrigger value="published">
            Published
            <span className="ml-1 text-xs tabular-nums text-slate-400">
              {publishedPosts.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed
            <span className="ml-1 text-xs tabular-nums text-slate-400">{failedPosts.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="mt-5">
          {loading ? (
            <ListSkeleton />
          ) : scheduledPosts.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No scheduled posts"
              description="The queue is empty. Write a post, pick a slot and it is stored server-side, then published by Inngest at that moment."
            >
              <Button asChild>
                <Link href="/posts/new">Schedule a post</Link>
              </Button>
            </EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {scheduledPosts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  onDelete={setPendingDelete}
                  onRetry={(target) => void retry(target)}
                  busy={busyId === post.id}
                />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="mt-5">
          {loading ? (
            <ListSkeleton />
          ) : draftPosts.length === 0 ? (
            <EmptyState
              icon={Save}
              title="No drafts yet"
              description="Drafts are unlimited on every plan, forever. Catch ideas the moment they arrive."
            >
              <Button asChild variant="secondary">
                <Link href="/posts/new">Start a draft</Link>
              </Button>
            </EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {draftPosts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  onDelete={setPendingDelete}
                  onRetry={(target) => void retry(target)}
                  busy={busyId === post.id}
                />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="published" className="mt-5">
          {loading ? (
            <ListSkeleton />
          ) : publishedPosts.length === 0 ? (
            <EmptyState
              icon={Send}
              title="Published history needs LinkedIn"
              description="Once your account is connected, posts published through Zybble appear here with their LinkedIn permalinks and metrics."
            >
              <ConnectLinkedInDialog>
                <Button>Connect LinkedIn</Button>
              </ConnectLinkedInDialog>
            </EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {publishedPosts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  onDelete={setPendingDelete}
                  onRetry={(target) => void retry(target)}
                  busy={busyId === post.id}
                />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="failed" className="mt-5">
          {loading ? (
            <ListSkeleton />
          ) : failedPosts.length === 0 ? (
            <EmptyState
              icon={Send}
              title="Nothing has failed"
              description="Expired tokens, revoked permissions, rate limits and LinkedIn downtime all land here with the reason and a retry action — never as a silent success."
            />
          ) : (
            <ul className="space-y-2.5">
              {failedPosts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  onDelete={setPendingDelete}
                  onRetry={(target) => void retry(target)}
                  busy={busyId === post.id}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete this {pendingDelete?.status === "scheduled" ? "scheduled post" : "post"}?
            </DialogTitle>
            <DialogDescription>
              &ldquo;{pendingDelete?.text.slice(0, 80) || "Untitled post"}
              {(pendingDelete?.text.length ?? 0) > 80 ? "…" : ""}&rdquo; will be removed from your
              workspace and any queued publish run cancelled. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" asChild>
              <DialogClose>Cancel</DialogClose>
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
              disabled={busyId !== null}
              onClick={() => pendingDelete && void remove(pendingDelete)}
            >
              {busyId !== null && <Loader2 className="animate-spin" aria-hidden />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading posts">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
