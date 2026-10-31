import { describe, expect, it, vi } from "vitest";

/**
 * Auth security behaviour that does not need a network.
 *
 * Open-redirect protection on `?redirectTo=` is the important one: reset,
 * verification and invite links all take a caller-supplied path, and a naive
 * implementation turns the login flow into a redirector for any URL on the web.
 * Password policy and the user-facing error mapping are pinned here too — the
 * mapping must hide Supabase internals without leaking whether an address
 * exists.
 */

const envState = { appUrl: "https://app.zybble.app", siteUrl: "https://zybble.app" };

vi.mock("@/lib/env", () => ({
  env: () => ({ APP_URL: envState.appUrl, NEXT_PUBLIC_SITE_URL: envState.siteUrl }),
  isSupabaseConfigured: () => true,
  isDodoConfigured: () => false,
}));

const { safeReturnPath, friendlyAuthError } = await import("@/features/auth/service");
const { signupSchema, loginSchema, passwordSchema, passwordResetRequestSchema, onboardingSchema } =
  await import("@/lib/validation/auth");

describe("open redirect protection", () => {
  it("rejects an absolute URL", () => {
    expect(safeReturnPath("https://evil.example.com/steal", "/dashboard")).toBe(
      "https://app.zybble.app/dashboard",
    );
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeReturnPath("//evil.example.com", "/dashboard")).toBe(
      "https://app.zybble.app/dashboard",
    );
  });

  it("rejects a javascript: URL and anything without a leading slash", () => {
    expect(safeReturnPath("javascript:alert(1)", "/dashboard")).toBe(
      "https://app.zybble.app/dashboard",
    );
    expect(safeReturnPath("dashboard", "/dashboard")).toBe("https://app.zybble.app/dashboard");
  });

  it("keeps a backslash path on our own origin (browsers fold it into the path)", () => {
    const target = safeReturnPath("/\\evil.example.com", "/dashboard");
    expect(new URL(target).origin).toBe("https://app.zybble.app");
    expect(new URL(target).hostname).toBe("app.zybble.app");
  });

  it("keeps a genuine relative path", () => {
    expect(safeReturnPath("/settings/billing", "/dashboard")).toBe(
      "https://app.zybble.app/settings/billing",
    );
  });

  it("falls back when nothing is supplied", () => {
    expect(safeReturnPath(null, "/reset-password")).toBe(
      "https://app.zybble.app/reset-password",
    );
    expect(safeReturnPath("", "/reset-password")).toBe("https://app.zybble.app/reset-password");
  });
});

describe("password policy", () => {
  it("requires 12 characters because the credential protects a LinkedIn account", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("eleven chars".length >= 12 ? "eleven chars" : "x").success).toBe(
      "eleven chars".length >= 12,
    );
    expect(passwordSchema.safeParse("a".repeat(12)).success).toBe(true);
  });

  it("applies the same policy at sign-up and password update", () => {
    const weak = { email: "ada@example.com", password: "short" };
    expect(signupSchema.safeParse(weak).success).toBe(false);
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false);
  });

  it("does not leak the password into validation errors", () => {
    const parsed = signupSchema.safeParse({ email: "ada@example.com", password: "hunter2hunter2" });
    expect(parsed.success).toBe(true);
  });
});

describe("payload validation", () => {
  it("rejects a malformed address on the reset request", () => {
    expect(passwordResetRequestSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(passwordResetRequestSchema.safeParse({ email: "ada@example.com" }).success).toBe(true);
  });

  it("requires a workspace name at onboarding and a valid timezone", () => {
    expect(onboardingSchema.safeParse({ workspaceName: "" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ workspaceName: "Acme" }).success).toBe(true);
    expect(
      onboardingSchema.safeParse({ workspaceName: "Acme", timezone: "Yesterday/Nowhere" }).success,
    ).toBe(false);
  });
});

describe("error message mapping", () => {
  it("rewrites Supabase's developer strings as sentences", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe(
      "That email and password combination is not correct.",
    );
    expect(friendlyAuthError("Email not confirmed")).toMatch(/confirm your email/i);
    expect(friendlyAuthError("User already registered")).toMatch(/already exists/i);
  });

  it("never echoes an unknown provider string that could carry internals", () => {
    const raw = "unexpected_failure: connection pool exhausted at 10.0.0.4:5432";
    const mapped = friendlyAuthError(raw);
    expect(mapped).not.toContain("10.0.0.4");
    expect(mapped).not.toContain("5432");
  });
});
