import { env, linkedinCapabilities } from "@/lib/env";

/**
 * LinkedIn API surface used by Zybble.
 *
 * Endpoints and payload shapes follow the current LinkedIn Marketing
 * documentation (Community Management API, Posts API, Images/Videos/Documents
 * API, Member Post Statistics). Nothing here is inferred from third-party blog
 * posts; where LinkedIn restricts a capability, this module reports it as such.
 */

export const LINKEDIN_ENDPOINTS = {
  authorization: "https://www.linkedin.com/oauth/v2/authorization",
  accessToken: "https://www.linkedin.com/oauth/v2/accessToken",
  userInfo: "https://api.linkedin.com/v2/userinfo",
  posts: "https://api.linkedin.com/rest/posts",
  images: "https://api.linkedin.com/rest/images",
  videos: "https://api.linkedin.com/rest/videos",
  documents: "https://api.linkedin.com/rest/documents",
  memberPostAnalytics: "https://api.linkedin.com/rest/memberCreatorPostAnalytics",
} as const;

/** Scopes Zybble needs, and what each one unlocks. */
export const LINKEDIN_SCOPES = {
  openid: "Authenticate the member (OpenID Connect).",
  profile: "Read the member's name and profile picture.",
  email: "Read the member's primary email address.",
  w_member_social: "Create posts on behalf of the member (publishing).",
  r_member_postAnalytics:
    "Read the member's own post analytics. Requires Community Management API approval.",
} as const;

export type LinkedInScope = keyof typeof LINKEDIN_SCOPES;

/**
 * Formats LinkedIn supports per the Posts API. WebP is intentionally absent:
 * the Images API accepts JPG, GIF and PNG only, so uploading WebP would fail
 * server-side after the user had already waited for the upload.
 */
export const MEDIA_LIMITS = {
  image: {
    mimeTypes: ["image/jpeg", "image/png", "image/gif"],
    maxBytes: 5 * 1024 * 1024,
    maxCount: 9,
    note: "LinkedIn's Images API accepts JPG, GIF and PNG up to 5 MB, and 2–20 images per multi-image post.",
  },
  video: {
    mimeTypes: ["video/mp4"],
    maxBytes: 200 * 1024 * 1024,
    maxCount: 1,
    note: "LinkedIn's Videos API accepts MP4 between 75 KB and 500 MB, 3 s–30 min. Zybble caps at 200 MB for upload reliability.",
  },
  document: {
    mimeTypes: ["application/pdf"],
    maxBytes: 100 * 1024 * 1024,
    maxCount: 1,
    note: "LinkedIn's Documents API accepts PDF (PPT/PPTX/DOC/DOCX are also supported by LinkedIn but not enabled here) up to 100 MB and 300 pages.",
  },
} as const;

export type MediaKind = keyof typeof MEDIA_LIMITS;

/**
 * Metrics LinkedIn returns through `memberCreatorPostAnalytics`.
 *
 * Only these five are guaranteed for the entity finder in every approved app;
 * the extended set (saves, sends, link clicks, followers gained, profile views)
 * is typed but only requested where the API version supports it, and stored as
 * NULL when LinkedIn does not return a value. Nothing is ever estimated.
 */
export const CORE_METRICS = [
  "IMPRESSION",
  "MEMBERS_REACHED",
  "REACTION",
  "COMMENT",
  "RESHARE",
] as const;

export const EXTENDED_METRICS = [
  "POST_SAVE",
  "POST_SEND",
  "LINK_CLICKS",
  "PREMIUM_CTA_CLICKS",
  "FOLLOWER_GAINED_FROM_CONTENT",
  "PROFILE_VIEW_FROM_CONTENT",
] as const;

/** Daily breakdown is not offered for these metrics. */
export const DAILY_UNSUPPORTED_METRICS = [
  "MEMBERS_REACHED",
  "LINK_CLICKS",
  "FOLLOWER_GAINED_FROM_CONTENT",
  "PROFILE_VIEW_FROM_CONTENT",
] as const;

export function linkedinVersion(): string {
  return env().LINKEDIN_API_VERSION;
}

/** LinkedIn rejects calls without these two headers. */
export function linkedinHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Linkedin-Version": linkedinVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

export function redirectUri(): string {
  const configured = env().LINKEDIN_REDIRECT_URI;

  if (configured) return configured;

  // Absolute, matches the value registered in the LinkedIn developer portal.
  return `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/linkedin/callback`;
}

export function capabilities() {
  return linkedinCapabilities();
}

/**
 * Serialise a LinkedIn URN for the `entity` query parameter of
 * memberCreatorPostAnalytics:
 *   urn:li:share:123   → (share:urn%3Ali%3Ashare%3A123)
 *   urn:li:ugcPost:123 → (ugc:urn%3Ali%3AugcPost%3A123)
 */
export function analyticsEntityParam(urn: string): string {
  const prefix = urn.replace(/^urn:li:/, "").split(":")[0];
  if (prefix === "share") return `(share:${encodeURIComponent(urn)})`;
  if (prefix === "ugcPost") return `(ugc:${encodeURIComponent(urn)})`;
  throw new Error(`Unsupported LinkedIn post URN for analytics: ${urn}`);
}

/** Build the `(start:(day:…,month:…,year:…),end:(…))` dateRange object. */
export function analyticsDateRange(start: Date, end: Date): string {
  const fmt = (date: Date) =>
    `(day:${date.getUTCDate()},month:${date.getUTCMonth() + 1},year:${date.getUTCFullYear()})`;
  return `(start:${fmt(start)},end:${fmt(end)})`;
}
