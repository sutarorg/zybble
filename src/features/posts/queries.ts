import { createMediaPreviewUrl } from "@/features/posts/media";
import type { WorkspaceContext } from "@/features/workspaces/access";
import { NotFoundError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { formatInZone, startOfUtcDay, toIsoDate } from "@/lib/time";
import type {
  MediaAssetRow,
  MediaKind,
  PostRow,
  PostStatus,
} from "@/lib/supabase/database.types";

/**
 * Read models for posts.
 *
 * The shapes returned here are the contract the dashboard renders
 * (`src/lib/app/types.ts`). Media `url` values are short-lived signed URLs
 * (60 s) minted on read — the bucket itself is private, so nothing is served by
 * a permanent, guessable link.
 */

export type MediaAssetRef = {
  id: string;
  kind: MediaKind;
  name: string;
  mimeType: string;
  bytes: number;
  url: string | null;
};

export type DashboardPost = {
  id: string;
  workspaceId: string;
  authorAccountId: string;
  text: string;
  media: MediaAssetRef[];
  status: PostStatus;
  scheduledAt: string | null;
  timezone: string | null;
  publishedAt: string | null;
  linkedinPostUrn: string | null;
  failureReason: string | null;
  failureCode: string | null;
  attempts: number;
  permalink: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarPost = DashboardPost & {
  /** Local calendar day (yyyy-MM-dd) in the requested timezone. */
  day: string;
  /** Local wall-clock time (HH:mm) in the requested timezone. */
  localTime: string | null;
};

export function permalinkFor(urn: string | null): string | null {
  if (!urn) return null;
  const id = urn.split(":").pop();
  if (!id) return null;

  if (urn.includes(":ugcPost:")) {
    return `https://www.linkedin.com/feed/update/urn:li:ugcPost:${id}`;
  }
  if (urn.includes(":share:")) {
    return `https://www.linkedin.com/feed/update/urn:li:share:${id}`;
  }

  return null;
}

function toMediaRef(row: MediaAssetRow, url: string | null): MediaAssetRef {
  return {
    id: row.id,
    kind: row.kind,
    name: row.file_name,
    mimeType: row.mime_type,
    bytes: row.byte_size,
    url,
  };
}

export async function withMedia(
  supabase: ServerSupabase,
  posts: PostRow[],
  options: { signedUrls: boolean } = { signedUrls: true },
): Promise<DashboardPost[]> {
  if (posts.length === 0) return [];

  const admin = createSupabaseAdminClient();

  const { data: media } = await admin
    .from("media_assets")
    .select("*")
    .in(
      "post_id",
      posts.map((post) => post.id),
    )
    .order("sort_order", { ascending: true });

  const byPost = new Map<string, MediaAssetRow[]>();

  for (const row of (media ?? []) as MediaAssetRow[]) {
    // `post_id` is nullable: an asset is uploaded before it is attached.
    if (!row.post_id) continue;
    const list = byPost.get(row.post_id) ?? [];
    list.push(row);
    byPost.set(row.post_id, list);
  }

  const previews = new Map<string, string | null>();

  if (options.signedUrls) {
    for (const row of (media ?? []) as MediaAssetRow[]) {
      previews.set(row.id, await createMediaPreviewUrl(row));
    }
  }

  void supabase;

  return posts.map((post) => ({
    id: post.id,
    workspaceId: post.workspace_id,
    authorAccountId: post.author_account_id,
    text: post.body,
    media: (byPost.get(post.id) ?? []).map((row) => toMediaRef(row, previews.get(row.id) ?? null)),
    status: post.status,
    scheduledAt: post.scheduled_at,
    timezone: post.timezone,
    publishedAt: post.published_at,
    linkedinPostUrn: post.linkedin_post_urn,
    failureReason: post.failure_reason,
    failureCode: post.failure_code,
    attempts: post.attempts,
    permalink: permalinkFor(post.linkedin_post_urn),
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  }));
}

export type ListPostsQuery = {
  status?: PostStatus;
  from?: string;
  to?: string;
  accountId?: string;
  limit: number;
};

export async function listPosts(
  context: WorkspaceContext,
  query: ListPostsQuery,
): Promise<DashboardPost[]> {
  const supabase = createSupabaseAdminClient();

  let builder = supabase
    .from("posts")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(query.limit);

  if (query.status) builder = builder.eq("status", query.status);
  if (query.accountId) builder = builder.eq("author_account_id", query.accountId);
  if (query.from) builder = builder.gte("scheduled_at", new Date(`${query.from}T00:00:00.000Z`).toISOString());
  if (query.to) builder = builder.lte("scheduled_at", new Date(`${query.to}T23:59:59.999Z`).toISOString());

  const { data, error } = await builder;

  if (error) throw new Error("Could not load posts.");

  return withMedia(supabase, (data ?? []) as PostRow[]);
}

export async function getPost(
  context: WorkspaceContext,
  postId: string,
): Promise<DashboardPost> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (error || !data) throw new NotFoundError("Post not found.");

  const [post] = await withMedia(supabase, [data as PostRow]);
  return post!;
}

/**
 * Calendar view.
 *
 * Bucketing happens in the requested IANA timezone on the server: `scheduled_at`
 * is stored as a UTC instant, so a post at 23:30 America/New_York is 03:30 UTC
 * the *next* day and would land on the wrong square if grouped in UTC.
 */
export async function listCalendar(
  context: WorkspaceContext,
  query: { from: string; to: string; timezone: string },
): Promise<{ days: Record<string, CalendarPost[]> }> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .in("status", ["scheduled", "published", "failed"])
    .gte("scheduled_at", new Date(`${query.from}T00:00:00.000Z`).toISOString())
    .lte("scheduled_at", new Date(`${query.to}T23:59:59.999Z`).toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(500);

  if (error) throw new Error("Could not load the calendar.");

  const posts = await withMedia(supabase, (data ?? []) as PostRow[]);
  const days: Record<string, CalendarPost[]> = {};

  // Widen the window by a day on each side so a post whose UTC instant falls
  // outside the requested range but whose local day is inside still appears.
  const cursor = startOfUtcDay(new Date(`${query.from}T00:00:00.000Z`));
  const end = new Date(`${query.to}T00:00:00.000Z`);

  for (let day = cursor; day <= end; day = new Date(day.getTime() + 86_400_000)) {
    days[toIsoDate(day)] = [];
  }

  for (const post of posts) {
    if (!post.scheduledAt) continue;

    const instant = new Date(post.scheduledAt);
    const local = formatInZone(instant, query.timezone);

    days[local.date] ??= [];
    days[local.date]!.push({ ...post, day: local.date, localTime: local.time });
  }

  return { days };
}
