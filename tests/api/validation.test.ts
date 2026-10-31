import { describe, expect, it } from "vitest";
import {
  createPostSchema,
  calendarQuerySchema,
  checkoutSchema,
  inviteMemberSchema,
  listPostsQuerySchema,
  updatePostSchema,
  workspaceCreateSchema,
} from "@/lib/validation/posts";
import {
  emailSchema,
  loginSchema,
  onboardingSchema,
  passwordSchema,
  passwordResetRequestSchema,
  signupSchema,
} from "@/lib/validation/auth";

/**
 * Input validation is the first line of defence for every endpoint, so the
 * schemas are tested for the cases that actually reach them: over-long bodies,
 * bogus timezones, schedule requests without a slot, and weak passwords.
 */

const UUID = "44444444-4444-4444-8444-444444444444";

describe("createPostSchema", () => {
  it("accepts a draft", () => {
    const parsed = createPostSchema.safeParse({
      authorAccountId: UUID,
      body: "Hello LinkedIn",
      intent: "draft",
      timezone: "Europe/London",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires a slot when scheduling", () => {
    const parsed = createPostSchema.safeParse({
      authorAccountId: UUID,
      body: "Schedule me",
      intent: "schedule",
    });
    expect(parsed.success).toBe(false);
  });

  it("enforces LinkedIn's 3,000-character body limit", () => {
    const parsed = createPostSchema.safeParse({
      authorAccountId: UUID,
      body: "x".repeat(3001),
      intent: "draft",
    });
    expect(parsed.success).toBe(false);

    expect(
      createPostSchema.safeParse({ authorAccountId: UUID, body: "x".repeat(3000), intent: "draft" })
        .success,
    ).toBe(true);
  });

  it("rejects a non-IANA timezone", () => {
    const parsed = createPostSchema.safeParse({
      authorAccountId: UUID,
      body: "hi",
      intent: "draft",
      timezone: "Yesterday/Nowhere",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a malformed authoring account id", () => {
    const parsed = createPostSchema.safeParse({
      authorAccountId: "not-a-uuid",
      body: "hi",
      intent: "draft",
    });
    expect(parsed.success).toBe(false);
  });

  it("caps the number of media assets", () => {
    const parsed = createPostSchema.safeParse({
      authorAccountId: UUID,
      body: "hi",
      intent: "draft",
      mediaAssetIds: Array.from({ length: 12 }, () => UUID),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("updatePostSchema", () => {
  it("allows partial updates", () => {
    expect(updatePostSchema.safeParse({ body: "edited" }).success).toBe(true);
    expect(updatePostSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a status the user cannot set directly", () => {
    expect(updatePostSchema.safeParse({ status: "published" }).success).toBe(false);
    expect(updatePostSchema.safeParse({ status: "publishing" }).success).toBe(false);
    expect(updatePostSchema.safeParse({ status: "cancelled" }).success).toBe(true);
  });
});

describe("query schemas", () => {
  it("parses list queries and refuses an unbounded page size", () => {
    const parsed = listPostsQuerySchema.parse({ limit: "50", status: "scheduled" });
    expect(parsed.limit).toBe(50);
    expect(parsed.status).toBe("scheduled");

    expect(listPostsQuerySchema.safeParse({ limit: "5000" }).success).toBe(false);
  });

  it("requires a date range for the calendar", () => {
    expect(calendarQuerySchema.safeParse({ from: "2026-05-01" }).success).toBe(false);
    expect(
      calendarQuerySchema.safeParse({ from: "2026-05-01", to: "2026-05-31" }).success,
    ).toBe(true);
  });

  it("rejects a free-text date", () => {
    expect(
      calendarQuerySchema.safeParse({ from: "yesterday", to: "tomorrow" }).success,
    ).toBe(false);
  });
});

describe("auth schemas", () => {
  it("requires a strong password on signup", () => {
    expect(signupSchema.safeParse({ email: "a@b.com", password: "short" }).success).toBe(false);
    expect(
      signupSchema.safeParse({ email: "a@b.com", password: "correct horse battery" }).success,
    ).toBe(true);
  });

  it("validates email shape", () => {
    expect(emailSchema.safeParse("nope").success).toBe(false);
    expect(emailSchema.safeParse("nope@").success).toBe(false);
    expect(emailSchema.safeParse("someone@example.com").success).toBe(true);
  });

  it("accepts any password length on login (the server decides)", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("defaults the onboarding timezone to UTC", () => {
    const parsed = onboardingSchema.parse({ workspaceName: "Acme" });
    expect(parsed.timezone).toBe("UTC");
  });

  it("applies the password policy on reset", () => {
    expect(passwordSchema.safeParse("1234567890").success).toBe(false);
    expect(passwordResetRequestSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
});

describe("workspace and billing schemas", () => {
  it("requires a workspace name", () => {
    expect(workspaceCreateSchema.safeParse({}).success).toBe(false);
    expect(workspaceCreateSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });

  it("normalises member roles", () => {
    const parsed = inviteMemberSchema.parse({ email: "Teammate@Example.com", role: "editor" });
    expect(parsed.role).toBe("editor");
  });

  it("rejects inviting an owner (there can be only one)", () => {
    expect(inviteMemberSchema.safeParse({ email: "a@b.com", role: "owner" }).success).toBe(false);
  });

  it("bounds checkout seat counts", () => {
    expect(checkoutSchema.safeParse({ seats: 0 }).success).toBe(false);
    expect(checkoutSchema.safeParse({}).success).toBe(true);
  });
});
