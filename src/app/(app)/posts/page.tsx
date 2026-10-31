"use client";

import { format, isPast } from "date-fns";
import {
  CalendarClock,
  ImageIcon,
  MoreHorizontal,
  PenSquare,
  Save,
  Send,
  Trash2,
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
import { useClientMounted, useLocalPosts } from "@/lib/app/hooks";
import { deleteLocalPost, type LocalPost } from "@/lib/app/local-posts";
import { cn } from "@/lib/utils";

function PostRow({ post, onDelete }: { post: LocalPost; onDelete: (p: LocalPost) => void }) {
  const overdue = post.status === "scheduled" && post.scheduledAt && isPast(new Date(post.scheduledAt));
  return (
    <li className="flex items-start gap-4 rounded-xl bg-white p-4 ring-1 ring-slate-200 transition-shadow hover:shadow-xs">
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1",
          post.status === "scheduled"
            ? "bg-brand-50 text-brand-600 ring-brand-100"
            : "bg-slate-100 text-slate-500 ring-slate-200",
        )}
      >
        {post.status === "scheduled" ? (
          <CalendarClock className="size-4" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
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
                {overdue ? " — past slot (local preview, no publish ran)" : ""}
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
      <Badge variant="neutral" className="hidden sm:inline-flex">Local</Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for "${post.text.slice(0, 40) || "untitled post"}"`}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/posts/${post.id}/edit`}>
              <PenSquare aria-hidden />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(post)}>
            <Trash2 aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export default function PostsPage() {
  const posts = useLocalPosts();
  const mounted = useClientMounted();
  const [pendingDelete, setPendingDelete] = useState<LocalPost | null>(null);

  const scheduled = posts.filter((p) => p.status === "scheduled");
  const drafts = posts.filter((p) => p.status === "draft");

  const counts = {
    scheduled: scheduled.length,
    drafts: drafts.length,
    published: 0,
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Your drafts and queue. Everything here is{" "}
          <span className="font-medium text-slate-700">stored locally</span> until account sync
          ships.
        </p>
        <Button asChild size="sm">
          <Link href="/posts/new">
            <PenSquare aria-hidden />
            New post
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="scheduled" className="mt-6">
        <TabsList>
          <TabsTrigger value="scheduled">
            Scheduled
            {mounted && <span className="ml-1 text-xs tabular-nums text-slate-400">{counts.scheduled}</span>}
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts
            {mounted && <span className="ml-1 text-xs tabular-nums text-slate-400">{counts.drafts}</span>}
          </TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="mt-5">
          {!mounted ? (
            <ListSkeleton />
          ) : scheduled.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No scheduled posts"
              description="The queue is empty. Write a post, pick a slot and it appears here — and on your calendar."
            >
              <Button asChild>
                <Link href="/posts/new">Schedule a post</Link>
              </Button>
            </EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {scheduled.map((post) => (
                <PostRow key={post.id} post={post} onDelete={setPendingDelete} />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="mt-5">
          {!mounted ? (
            <ListSkeleton />
          ) : drafts.length === 0 ? (
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
              {drafts.map((post) => (
                <PostRow key={post.id} post={post} onDelete={setPendingDelete} />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="published" className="mt-5">
          <EmptyState
            icon={Send}
            title="Published history needs LinkedIn"
            description="Once your account is connected, posts published through Zybble appear here with their LinkedIn permalinks and metrics."
          >
            <ConnectLinkedInDialog>
              <Button>Connect LinkedIn</Button>
            </ConnectLinkedInDialog>
          </EmptyState>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this {pendingDelete?.status === "scheduled" ? "scheduled post" : "draft"}?</DialogTitle>
            <DialogDescription>
              &ldquo;{pendingDelete?.text.slice(0, 80) || "Untitled post"}
              {(pendingDelete?.text.length ?? 0) > 80 ? "…" : ""}&rdquo; will be removed from this
              browser&rsquo;s local preview store. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" asChild>
              <DialogClose>Cancel</DialogClose>
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
              onClick={() => {
                if (pendingDelete) deleteLocalPost(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
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
