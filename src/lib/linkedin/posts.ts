import { restliIdFrom, LinkedInApiError, linkedinRequestWithHeaders } from "./client";
import { LINKEDIN_ENDPOINTS } from "./config";
import type { MediaKind } from "./config";

/**
 * Create posts through LinkedIn's Posts API (the successor to ugcPosts).
 *
 * Only formats the granted permission actually allows are built here:
 *  * text          — `w_member_social`
 *  * single image  — `w_member_social` + uploaded `urn:li:image:*`
 *  * multi-image   — `w_member_social` + 2–20 uploaded images (MultiImage API)
 *  * video         — `w_member_social` + `urn:li:video:*`
 *  * document      — `w_member_social` + `urn:li:document:*`
 *
 * Company-page posting would need `w_organization_social` plus page roles, which
 * Zybble does not request, so organisation authors are rejected with a clear
 * message rather than silently attempted.
 */

export type PostContent =
  | { kind: "text" }
  | { kind: "image"; assetUrns: string[] }
  | { kind: "video"; assetUrn: string; title?: string }
  | { kind: "document"; assetUrn: string; title?: string };

export type CreatePostInput = {
  authorUrn: string;
  commentary: string;
  content: PostContent;
  /** LinkedIn caps commentary at 3000 characters. */
  maxChars?: number;
};

export type CreatedPost = {
  urn: string;
  /** Echoed back for logging (never contains credentials). */
  authorUrn: string;
};

const COMMENTARY_LIMIT = 3000;

export function buildPostPayload(input: CreatePostInput): Record<string, unknown> {
  const limit = input.maxChars ?? COMMENTARY_LIMIT;
  const commentary = input.commentary.slice(0, limit);

  if (input.authorUrn.startsWith("urn:li:organization:")) {
    throw new LinkedInApiError({
      status: 403,
      code: "ORGANIZATION_NOT_SUPPORTED",
      message:
        "Zybble only requests member publishing permission (w_member_social). Company-page posting needs w_organization_social and a page admin role.",
      kind: "forbidden",
    });
  }

  const payload: Record<string, unknown> = {
    author: input.authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  switch (input.content.kind) {
    case "text":
      break;
    case "image":
      if (input.content.assetUrns.length === 1) {
        payload.content = { media: { id: input.content.assetUrns[0] } };
      } else {
        payload.content = {
          multiImage: {
            images: input.content.assetUrns.map((id) => ({ id })),
          },
        };
      }
      break;
    case "video":
      payload.content = {
        media: {
          id: input.content.assetUrn,
          ...(input.content.title ? { title: input.content.title } : {}),
        },
      };
      break;
    case "document":
      payload.content = {
        media: {
          id: input.content.assetUrn,
          ...(input.content.title ? { title: input.content.title } : {}),
        },
      };
      break;
  }

  return payload;
}

/**
 * Create the post. The identifier comes back in the `x-restli-id` response
 * header (`urn:li:share:…` or `urn:li:ugcPost:…`), not in the body.
 *
 * Idempotency: LinkedIn's Posts API has no idempotency key. Duplicate
 * protection lives in `public.post_publish_attempts` — the caller claims an
 * attempt number before invoking this and records the URN on completion, so a
 * retry after a timeout cannot create a second post (see
 * src/features/posts/publish.ts).
 */
export async function createPost(
  accessToken: string,
  input: CreatePostInput,
): Promise<CreatedPost> {
  const payload = buildPostPayload(input);

  const { headers, status } = await linkedinRequestWithHeaders<unknown>(
    LINKEDIN_ENDPOINTS.posts,
    {
      accessToken,
      method: "POST",
      body: payload,
      // A publish call is not safely retryable at the transport layer: a
      // timeout may still have created the post. Retry policy is handled by
      // the attempt ledger instead.
      retries: 0,
    },
  );

  if (status !== 201) {
    throw new LinkedInApiError({
      status,
      code: "UNEXPECTED_POST_RESPONSE",
      message: `LinkedIn returned HTTP ${status} instead of 201 Created.`,
    });
  }

  const urn = restliIdFrom(headers);

  if (!urn) {
    throw new LinkedInApiError({
      status,
      code: "MISSING_POST_URN",
      message:
        "LinkedIn created the post but did not return its identifier. Check the account's feed before retrying.",
      kind: "unknown",
    });
  }

  return { urn, authorUrn: input.authorUrn };
}

export function supportedMediaKinds(): MediaKind[] {
  return ["image", "video", "document"];
}
