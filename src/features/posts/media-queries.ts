import { createMediaPreviewUrl } from "@/features/posts/media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MediaAssetRow } from "@/lib/supabase/database.types";

/**
 * Media read model.
 *
 * Preview URLs are 60-second signed links minted on read; the bucket is private,
 * so nothing is reachable by a permanent URL and a link that leaks expires
 * almost immediately.
 */
export type MediaAssetView = {
  id: string;
  kind: MediaAssetRow["kind"];
  name: string;
  mimeType: string;
  bytes: number;
  postId: string | null;
  url: string | null;
};

export async function listMediaAssets(
  workspaceId: string,
  options: { postId?: string | null } = {},
): Promise<MediaAssetView[]> {
  const admin = createSupabaseAdminClient();

  let builder = admin
    .from("media_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (options.postId) builder = builder.eq("post_id", options.postId);

  const { data } = await builder;
  const rows = (data ?? []) as MediaAssetRow[];

  const views: MediaAssetView[] = [];

  for (const row of rows) {
    views.push({
      id: row.id,
      kind: row.kind,
      name: row.file_name,
      mimeType: row.mime_type,
      bytes: row.byte_size,
      postId: row.post_id,
      url: await createMediaPreviewUrl(row),
    });
  }

  return views;
}
