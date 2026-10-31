import { inngest } from "@/inngest/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  LinkedInAccountRow,
  MediaAssetRow,
  PostRow,
} from "@/lib/supabase/database.types";
import { LinkedInApiError } from "@/lib/linkedin/client";
import { createPost, type PostContent } from "@/lib/linkedin/posts";
import {
  finalizeVideoUpload,
  initializeDocumentUpload,
  initializeImageUpload,
  initializeVideoUpload,
  uploadBinary,
  VIDEO_PART_SIZE,
  validateMedia,
} from "@/lib/linkedin/media";
import { getUsableConnection, LinkedInConnectionError, markConnectionStatus } from "@/features/linkedin/tokens";
import { loadMediaBytes } from "./media";

/**
 * The publish pipeline.
 *
 * Duplicate-publish prevention is the whole point of this file, so the ordering
 * is deliberate:
 *
 *  1. Re-read the post and refuse to continue unless it is genuinely due
 *     (`scheduled`, not already published, not cancelled).
 *  2. Claim an attempt number in `post_publish_attempts`. The unique index on
 *     (post_id, attempt) means two concurrent workers cannot both claim the
 *     same attempt, and a retry always uses a *new* attempt number.
 *  3. Re-assert `linkedin_post_urn is null` inside the update that flips the
 *     post to `publishing` — a compare-and-swap that a second run loses.
 *  4. Only then call LinkedIn, once, with transport retries disabled.
 *  5. Record the returned URN on the attempt, finishing the claim.
 *
 * A run that never reports back leaves an attempt in `started`; the reconcile
 * function resolves those as UNKNOWN_OUTCOME and tells the user to check
 * LinkedIn before retrying, rather than gambling on a second post.
 */

export const MAX_PUBLISH_ATTEMPTS = 3;

export type PublishOutcome = {
  status: "published" | "failed" | "skipped";
  postId: string;
  urn?: string;
  reason?: string;
  retryable?: boolean;
  attempt?: number;
};

/** Terminal per-attempt outcomes considered "the run is over". */
const STALE_ATTEMPT_MINUTES = 15;

export async function publishPostById(input: {
  postId: string;
  workspaceId: string;
  attempt: number;
}): Promise<PublishOutcome> {
  const admin = createSupabaseAdminClient();

  // --- 1. load and guard ----------------------------------------------------
  const { data: post, error } = await admin
    .from("posts")
    .select("*")
    .eq("id", input.postId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error || !post) {
    logger.error("publish.post_missing", { postId: input.postId, error: error?.message });
    return { status: "skipped", postId: input.postId, reason: "Post not found." };
  }

  const postRow = post as PostRow;

  if (postRow.status === "published") {
    return {
      status: "skipped",
      postId: postRow.id,
      reason: "Already published.",
      urn: postRow.linkedin_post_urn ?? undefined,
    };
  }

  if (postRow.status === "cancelled") {
    return { status: "skipped", postId: postRow.id, reason: "Post was cancelled." };
  }

  if (postRow.status === "draft") {
    return { status: "skipped", postId: postRow.id, reason: "Post is a draft." };
  }

  if (postRow.status === "publishing") {
    return {
      status: "skipped",
      postId: postRow.id,
      reason: "Another publish run is already in flight.",
    };
  }

  if (postRow.linkedin_post_urn) {
    return {
      status: "skipped",
      postId: postRow.id,
      reason: "Post already has a LinkedIn URN.",
      urn: postRow.linkedin_post_urn,
    };
  }

  if (input.attempt > MAX_PUBLISH_ATTEMPTS) {
    return {
      status: "skipped",
      postId: postRow.id,
      reason: `Attempt ${input.attempt} exceeds the ${MAX_PUBLISH_ATTEMPTS}-attempt ceiling.`,
    };
  }

  // --- 2. claim the attempt -------------------------------------------------
  const claimed = await admin
    .from("post_publish_attempts")
    .insert({
      post_id: postRow.id,
      attempt: input.attempt,
      outcome: "started",
    })
    .select("id")
    .maybeSingle();

  if (claimed.error) {
    // 23505 = unique violation: another worker owns this attempt number.
    logger.warn("publish.attempt_already_claimed", {
      postId: postRow.id,
      attempt: input.attempt,
      error: claimed.error.message,
    });
    return {
      status: "skipped",
      postId: postRow.id,
      reason: "This publish attempt was already claimed by another run.",
    };
  }

  const attemptId = claimed.data?.id as string | undefined;

  // --- 3. compare-and-swap the post into `publishing` -----------------------
  const { data: locked, error: lockError } = await admin
    .from("posts")
    .update({ status: "publishing", attempts: input.attempt, updated_at: new Date().toISOString() })
    .eq("id", postRow.id)
    .eq("workspace_id", input.workspaceId)
    .is("linkedin_post_urn", null)
    .in("status", ["scheduled", "failed"])
    .select("id")
    .maybeSingle();

  if (lockError || !locked) {
    await admin
      .from("post_publish_attempts")
      .update({
        outcome: "skipped",
        finished_at: new Date().toISOString(),
        error_code: "LOCK_LOST",
        error_message: "Another run owns this post.",
      })
      .eq("id", attemptId ?? "");

    return {
      status: "skipped",
      postId: postRow.id,
      reason: "Lost the publish lock to another run.",
    };
  }

  // --- 4. do the work -------------------------------------------------------
  try {
    const connection = await getUsableConnection(postRow.author_account_id);

    const content = await buildContent(
      connection.accessToken,
      postRow,
      connection.account.profile_urn,
    );

    const created = await createPost(connection.accessToken, {
      authorUrn: connection.account.profile_urn,
      commentary: postRow.body,
      content,
    });

    const now = new Date().toISOString();

    await admin
      .from("posts")
      .update({
        status: "published",
        published_at: now,
        linkedin_post_urn: created.urn,
        failure_reason: null,
        failure_code: null,
        last_error_at: null,
        attempts: input.attempt,
      })
      .eq("id", postRow.id);

    await admin
      .from("post_publish_attempts")
      .update({
        outcome: "succeeded",
        linkedin_post_urn: created.urn,
        finished_at: now,
      })
      .eq("id", attemptId ?? "");

    await markConnectionStatus(connection.account.id, "active", {
      code: null,
      message: null,
    });

    logger.info("publish.succeeded", {
      postId: postRow.id,
      workspaceId: input.workspaceId,
      attempt: input.attempt,
      urnPrefix: created.urn.split(":").slice(0, 3).join(":"),
    });

    return { status: "published", postId: postRow.id, urn: created.urn, attempt: input.attempt };
  } catch (error) {
    return handlePublishFailure({
      post: postRow,
      attempt: input.attempt,
      attemptId: attemptId ?? null,
      error,
    });
  }
}

async function buildContent(
  accessToken: string,
  post: PostRow,
  ownerUrn: string,
): Promise<PostContent> {
  const admin = createSupabaseAdminClient();

  const { data: assets } = await admin
    .from("media_assets")
    .select("*")
    .eq("post_id", post.id)
    .order("sort_order", { ascending: true });

  const media = (assets ?? []) as MediaAssetRow[];

  if (media.length === 0) return { kind: "text" };

  const urns: string[] = [];
  const imageUrns: string[] = [];

  for (const asset of media) {
    validateMedia({ kind: asset.kind, mimeType: asset.mime_type, byteSize: asset.byte_size });

    // LinkedIn requires the asset owner to be the authoring member URN.
    const urn = await uploadAssetToLinkedIn({ accessToken, asset, ownerUrn });
    urns.push(urn);
    if (asset.kind === "image") imageUrns.push(urn);

    await admin
      .from("media_assets")
      .update({
        upload_status: "registered",
        linkedin_asset_urn: urn,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asset.id);
  }

  const first = media[0]!;

  if (first.kind === "video") {
    return { kind: "video", assetUrn: urns[0]!, title: first.file_name };
  }

  if (first.kind === "document") {
    return { kind: "document", assetUrn: urns[0]!, title: first.file_name };
  }

  return { kind: "image", assetUrns: imageUrns };
}

async function uploadAssetToLinkedIn(input: {
  accessToken: string;
  asset: MediaAssetRow;
  ownerUrn: string;
}): Promise<string> {
  const { accessToken, asset, ownerUrn: owner } = input;

  if (asset.kind === "image") {
    const registration = await initializeImageUpload(accessToken, owner);
    const bytes = await loadMediaBytes(asset);
    await uploadBinary(accessToken, registration.uploadUrl, bytes, asset.mime_type);
    return registration.assetUrn;
  }

  if (asset.kind === "document") {
    const registration = await initializeDocumentUpload(accessToken, owner);
    const bytes = await loadMediaBytes(asset);
    await uploadBinary(accessToken, registration.uploadUrl, bytes, asset.mime_type);
    return registration.assetUrn;
  }

  const registration = await initializeVideoUpload(accessToken, owner, asset.byte_size);
  const bytes = await loadMediaBytes(asset);
  const instructions = registration.uploadInstructions ?? [];
  const partIds: string[] = [];

  for (const instruction of instructions) {
    const slice = bytes.subarray(
      instruction.firstByte,
      Math.min(instruction.lastByte + 1, bytes.byteLength),
    );

    const response = await fetch(instruction.uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": asset.mime_type,
      },
      body: new Uint8Array(slice),
    });

    if (!response.ok) {
      throw new LinkedInApiError({
        status: response.status,
        code: "VIDEO_PART_UPLOAD_FAILED",
        message: `LinkedIn rejected video part ${partIds.length + 1} (HTTP ${response.status}).`,
        kind: response.status >= 500 ? "server_error" : "validation",
      });
    }

    const etag = response.headers.get("etag");
    partIds.push(etag ? etag.replaceAll('"', "") : `part-${partIds.length + 1}`);
  }

  if (registration.uploadToken) {
    await finalizeVideoUpload(accessToken, {
      videoUrn: registration.assetUrn,
      uploadToken: registration.uploadToken,
      uploadedPartIds: partIds,
    });
  }

  return registration.assetUrn;
}

async function handlePublishFailure(input: {
  post: PostRow;
  attempt: number;
  attemptId: string | null;
  error: unknown;
}): Promise<PublishOutcome> {
  const { post, attempt, attemptId, error } = input;
  const admin = createSupabaseAdminClient();

  let userMessage = "Publishing to LinkedIn failed. The failure has been logged.";
  let code = "UNKNOWN";
  let retryable = false;

  if (error instanceof LinkedInConnectionError) {
    userMessage = error.message;
    code = error.reason.toUpperCase();
    retryable = false;
  } else if (error instanceof LinkedInApiError) {
    userMessage = error.userMessage();
    code = error.code ?? error.kind.toUpperCase();
    retryable = error.retryable;

    if (error.kind === "unauthorized" || error.kind === "forbidden") {
      await markConnectionStatus(post.author_account_id, "reauth_required", {
        code: error.code ?? null,
        message: userMessage,
      });
    }
  } else if (error instanceof Error) {
    userMessage = error.message;
  }

  const now = new Date().toISOString();

  await admin
    .from("post_publish_attempts")
    .update({
      outcome: "failed",
      error_code: code,
      error_message: userMessage,
      retryable,
      finished_at: now,
    })
    .eq("id", attemptId ?? "");

  await admin
    .from("posts")
    .update({
      status: "failed",
      failure_reason: userMessage,
      failure_code: code,
      last_error_at: now,
      attempts: attempt,
    })
    .eq("id", post.id);

  logger.error("publish.failed", {
    postId: post.id,
    workspaceId: post.workspace_id,
    attempt,
    code,
    retryable,
  });

  return { status: "failed", postId: post.id, reason: userMessage, retryable, attempt };
}

/**
 * Resolve runs that never reported back (process killed mid-request, LinkedIn
 * hung past the timeout). We cannot know whether LinkedIn created the post, so
 * the outcome is reported honestly as UNKNOWN and the user is told to look at
 * their feed before retrying.
 */
export async function reconcileStuckPosts(): Promise<{ resolved: number }> {
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - STALE_ATTEMPT_MINUTES * 60_000).toISOString();

  const { data: stuck } = await admin
    .from("post_publish_attempts")
    .select("id, post_id, attempt, started_at")
    .eq("outcome", "started")
    .lt("started_at", cutoff);

  const rows = (stuck ?? []) as Array<{
    id: string;
    post_id: string;
    attempt: number;
    started_at: string;
  }>;

  for (const row of rows) {
    await admin
      .from("post_publish_attempts")
      .update({
        outcome: "failed",
        error_code: "UNKNOWN_OUTCOME",
        error_message:
          "The publish run did not report back. Check your LinkedIn feed before retrying — the post may already be live.",
        retryable: false,
        finished_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    await admin
      .from("posts")
      .update({
        status: "failed",
        failure_code: "UNKNOWN_OUTCOME",
        failure_reason:
          "The publish run did not report back. Check your LinkedIn feed before retrying — the post may already be live.",
        last_error_at: new Date().toISOString(),
      })
      .eq("id", row.post_id)
      .eq("status", "publishing");
  }

  if (rows.length > 0) {
    logger.warn("publish.reconciled_stuck_runs", { count: rows.length });
  }

  return { resolved: rows.length };
}

/** Emit lifecycle events after a publish attempt. */
export async function emitPublishEvents(outcome: PublishOutcome & { workspaceId: string }) {
  if (env().INNGEST_EVENT_KEY === undefined && env().NODE_ENV !== "production") {
    // In local development without Inngest configured, skip event delivery
    // rather than failing the publish.
    return;
  }

  if (outcome.status === "published" && outcome.urn) {
    await inngest.send({
      name: "post/published",
      data: { postId: outcome.postId, workspaceId: outcome.workspaceId, linkedinPostUrn: outcome.urn },
    });
    return;
  }

  if (outcome.status === "failed") {
    await inngest.send({
      name: "post/publish.failed",
      data: {
        postId: outcome.postId,
        workspaceId: outcome.workspaceId,
        attempt: outcome.attempt ?? 1,
        retryable: Boolean(outcome.retryable),
        reason: outcome.reason ?? "Publishing failed.",
      },
    });
  }
}

export type { LinkedInAccountRow };
