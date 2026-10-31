import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * LinkedIn capability gating.
 *
 * The brief is explicit: do not assume dev access equals production access, and
 * when a permission is missing build a capability-gated state plus a documented
 * blocker instead of inventing the capability. These tests pin that behaviour:
 *
 *  - `w_member_social` is what makes publishing possible,
 *  - `r_member_postAnalytics` is only requested when Community Management API
 *    access has actually been granted,
 *  - a connection without the analytics scope reads analytics as unavailable
 *    rather than returning zeroes.
 */

const envState = {
  configured: true,
  analyticsEnabled: false,
  version: "202511",
};

vi.mock("@/lib/env", () => ({
  env: () => ({
    LINKEDIN_CLIENT_ID: envState.configured ? "client-id" : "",
    LINKEDIN_CLIENT_SECRET: envState.configured ? "client-secret" : "",
    LINKEDIN_REDIRECT_URI: envState.configured
      ? "https://app.example.com/api/linkedin/callback"
      : "",
    LINKEDIN_ANALYTICS_SCOPE_ENABLED: envState.analyticsEnabled,
    LINKEDIN_API_VERSION: envState.version,
    NEXT_PUBLIC_SITE_URL: "https://app.example.com",
  }),
  isSupabaseConfigured: () => true,
  isDodoConfigured: () => false,
  linkedinCapabilities: () => ({
    configured: envState.configured,
    publishing: envState.configured,
    analytics: envState.configured && envState.analyticsEnabled,
    apiVersion: envState.version,
    scopes: [
      "openid",
      "profile",
      "email",
      "w_member_social",
      ...(envState.analyticsEnabled ? ["r_member_postAnalytics"] : []),
    ],
    blockers: [] as string[],
  }),
}));

const { deriveCapabilities } = await import("@/features/linkedin/tokens");
const { capabilities, analyticsEntityParam, analyticsDateRange, MEDIA_LIMITS, LINKEDIN_SCOPES } =
  await import("@/lib/linkedin/config");

afterEach(() => {
  envState.configured = true;
  envState.analyticsEnabled = false;
});

describe("capability reporting", () => {
  it("requests publishing always and analytics only when approved", () => {
    envState.analyticsEnabled = false;
    expect(capabilities().scopes).toContain("w_member_social");
    expect(capabilities().scopes).not.toContain("r_member_postAnalytics");
    expect(capabilities().analytics).toBe(false);

    envState.analyticsEnabled = true;
    expect(capabilities().scopes).toContain("r_member_postAnalytics");
    expect(capabilities().analytics).toBe(true);
  });

  it("reports publishing as unavailable when the app is not configured", () => {
    envState.configured = false;
    const state = capabilities();
    expect(state.configured).toBe(false);
    expect(state.publishing).toBe(false);
  });

  it("sends the LinkedIn-Version header version the API requires", () => {
    expect(capabilities().apiVersion).toMatch(/^\d{6}$/);
  });
});

describe("scope-derived capabilities", () => {
  it("needs w_member_social to publish", () => {
    expect(deriveCapabilities(["openid", "profile", "email"]).canPublish).toBe(false);
    expect(deriveCapabilities(["openid", "w_member_social"]).canPublish).toBe(true);
  });

  it("needs r_member_postAnalytics to read analytics", () => {
    expect(deriveCapabilities(["w_member_social"]).canReadAnalytics).toBe(false);
    expect(deriveCapabilities(["w_member_social", "r_member_postAnalytics"]).canReadAnalytics).toBe(
      true,
    );
  });

  it("reports a connection as publish-only when the analytics scope was denied", () => {
    // The realistic case: LinkedIn granted publishing but not post analytics.
    const granted = deriveCapabilities(["openid", "profile", "email", "w_member_social"]);
    expect(granted).toEqual({ canPublish: true, canReadAnalytics: false });
  });
});

describe("analytics request shapes", () => {
  it("serialises share and ugcPost URNs the way the API expects", () => {
    expect(analyticsEntityParam("urn:li:share:123")).toBe("(share:urn%3Ali%3Ashare%3A123)");
    expect(analyticsEntityParam("urn:li:ugcPost:123")).toBe("(ugc:urn%3Ali%3AugcPost%3A123)");
  });

  it("refuses a URN it does not know how to query", () => {
    expect(() => analyticsEntityParam("urn:li:person:123")).toThrow(/Unsupported/);
  });

  it("builds the dateRange object in UTC components", () => {
    const range = analyticsDateRange(
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T00:00:00Z"),
    );
    expect(range).toBe("(start:(day:1,month:3,year:2026),end:(day:31,month:3,year:2026))");
  });
});

describe("media limits", () => {
  it("accepts only the image formats LinkedIn's Images API accepts", () => {
    expect(MEDIA_LIMITS.image.mimeTypes).toEqual(["image/jpeg", "image/png", "image/gif"]);
    // WebP would fail server-side after the upload, so it is rejected up front.
    expect(MEDIA_LIMITS.image.mimeTypes).not.toContain("image/webp");
  });

  it("caps images at 5 MB and 9 per post", () => {
    expect(MEDIA_LIMITS.image.maxBytes).toBe(5 * 1024 * 1024);
    expect(MEDIA_LIMITS.image.maxCount).toBeLessThanOrEqual(9);
  });

  it("allows exactly one video or one document per post", () => {
    expect(MEDIA_LIMITS.video.maxCount).toBe(1);
    expect(MEDIA_LIMITS.document.maxCount).toBe(1);
  });

  it("documents every scope it requests", () => {
    for (const scope of capabilities().scopes) {
      expect(LINKEDIN_SCOPES, scope).toHaveProperty(scope);
    }
  });
});
