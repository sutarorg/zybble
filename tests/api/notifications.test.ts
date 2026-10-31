import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "../helpers/fake-supabase";

/**
 * Transactional email: template rendering and preference gating.
 *
 * Two promises are being tested. The first is that a switched-off preference
 * really stops the email rather than just greying out a checkbox. The second is
 * that email delivery is best-effort: a Resend outage is recorded and counted,
 * never thrown into the workflow that triggered it.
 */

const USER = "55555555-5555-4555-8555-555555555555";
const OTHER = "66666666-6666-4666-8666-666666666666";

const adminState = { current: null as FakeSupabase | null };
const resendState = { sent: [] as Array<{ to: string; subject: string; html: string; text: string }>, failing: false };

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminState.current,
}));

vi.mock("@/lib/resend/client", () => ({
  sendEmail: async (input: { to: string; subject: string; html: string; text: string }) => {
    if (resendState.failing) return { sent: false, id: null, error: "Resend 500" };
    resendState.sent.push(input);
    return { sent: true, id: "re_123", error: null };
  },
}));

const {
  deliverTemplateToUser,
  deliverTemplateToWorkspace,
  deliverInvitationEmail,
  renderTemplate,
  TEMPLATE_PREFERENCE,
} = await import("@/features/notifications/email");

const ALL_ON = {
  email_post_published: true,
  email_post_failed: true,
  email_post_reminder: true,
  email_token_expiring: true,
  email_billing: true,
  email_product_updates: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

beforeEach(() => {
  resendState.sent = [];
  resendState.failing = false;
});

afterEach(() => {
  adminState.current = null;
});

describe("preference gating", () => {
  it("skips a template whose switch is off", async () => {
    adminState.current = createFakeSupabase({
      profiles: { single: { email: "user@example.com", full_name: "Ada" } },
      notification_preferences: { single: { ...ALL_ON, email_post_published: false } },
    });

    const result = await deliverTemplateToUser({
      userId: USER,
      template: "post_published",
      payload: { postTitle: "Hello" },
    });

    expect(result).toMatchObject({ sent: 0, skipped: 1, failed: 0 });
    expect(resendState.sent).toHaveLength(0);
  });

  it("sends the same template when the switch is on", async () => {
    adminState.current = createFakeSupabase({
      profiles: { single: { email: "user@example.com", full_name: "Ada" } },
      notification_preferences: { single: ALL_ON },
    });

    const result = await deliverTemplateToUser({
      userId: USER,
      template: "post_published",
      payload: { postTitle: "Hello" },
    });

    expect(result).toMatchObject({ sent: 1, skipped: 0, failed: 0 });
    expect(resendState.sent[0]!.to).toBe("user@example.com");
  });

  it("defaults to sending when no preference row exists yet", async () => {
    adminState.current = createFakeSupabase({
      profiles: { single: { email: "user@example.com", full_name: "Ada" } },
      notification_preferences: { single: null },
    });

    const result = await deliverTemplateToUser({ userId: USER, template: "post_failed" });

    expect(result.sent).toBe(1);
  });

  it("always delivers transactional templates regardless of switches", async () => {
    expect(TEMPLATE_PREFERENCE.welcome).toBeNull();
    expect(TEMPLATE_PREFERENCE.team_invitation).toBeNull();

    adminState.current = createFakeSupabase({
      profiles: { single: { email: "new@example.com", full_name: null } },
      notification_preferences: { single: { ...ALL_ON, email_billing: false } },
    });

    const result = await deliverTemplateToUser({ userId: USER, template: "welcome" });

    expect(result.sent).toBe(1);
  });

  it("maps billing templates onto the single billing switch", async () => {
    expect(TEMPLATE_PREFERENCE.subscription_confirmed).toBe("email_billing");
    expect(TEMPLATE_PREFERENCE.payment_failed).toBe("email_billing");
    expect(TEMPLATE_PREFERENCE.subscription_cancelled).toBe("email_billing");
  });

  it("honours each member's own switch on a workspace-wide send", async () => {
    adminState.current = createFakeSupabase({
      workspace_members: { rows: [{ user_id: USER }, { user_id: OTHER }] },
      profiles: {
        singleQueue: [
          { email: "a@example.com", full_name: "Ada" },
          { email: "b@example.com", full_name: "Bo" },
        ],
      },
      notification_preferences: {
        singleQueue: [
          { ...ALL_ON, email_post_failed: true },
          { ...ALL_ON, email_post_failed: false },
        ],
      },
    });

    const result = await deliverTemplateToWorkspace({
      workspaceId: "77777777-7777-4777-8777-777777777777",
      template: "post_failed",
    });

    expect(result).toMatchObject({ sent: 1, skipped: 1, failed: 0 });
    expect(resendState.sent).toHaveLength(1);
    expect(resendState.sent[0]!.to).toBe("a@example.com");
  });
});

describe("delivery failures", () => {
  it("counts a Resend failure instead of throwing", async () => {
    resendState.failing = true;

    adminState.current = createFakeSupabase({
      profiles: { single: { email: "user@example.com", full_name: "Ada" } },
      notification_preferences: { single: ALL_ON },
    });

    const result = await deliverTemplateToUser({ userId: USER, template: "post_published" });

    expect(result).toMatchObject({ sent: 0, skipped: 0, failed: 1 });
  });

  it("skips silently when the profile has no address", async () => {
    adminState.current = createFakeSupabase({
      profiles: { single: null },
      notification_preferences: { single: ALL_ON },
    });

    const result = await deliverTemplateToUser({ userId: USER, template: "post_published" });

    expect(result.skipped).toBe(1);
    expect(resendState.sent).toHaveLength(0);
  });
});

describe("invitations", () => {
  it("sends to the invited address, not to a member id", async () => {
    adminState.current = createFakeSupabase({
      workspace_members: {
        single: {
          email: "invitee@example.com",
          status: "invited",
          invite_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
      },
    });

    const result = await deliverInvitationEmail({
      invitationId: "inv-1",
      workspaceName: "Ada's workspace",
    });

    expect(result).toMatchObject({ sent: 1 });
    expect(resendState.sent[0]!.to).toBe("invitee@example.com");
  });

  it("refuses to mail an invitation that was already accepted or revoked", async () => {
    adminState.current = createFakeSupabase({
      workspace_members: { single: { email: "x@example.com", status: "active", invite_expires_at: null } },
    });

    const result = await deliverInvitationEmail({ invitationId: "inv-1" });

    expect(result.skipped).toBe(1);
    expect(resendState.sent).toHaveLength(0);
  });

  it("refuses to mail an expired invitation", async () => {
    adminState.current = createFakeSupabase({
      workspace_members: {
        single: {
          email: "x@example.com",
          status: "invited",
          invite_expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      },
    });

    const result = await deliverInvitationEmail({ invitationId: "inv-1" });

    expect(result.skipped).toBe(1);
    expect(resendState.sent).toHaveLength(0);
  });
});

describe("template rendering", () => {
  it("escapes user content so a post title cannot inject markup", () => {
    const rendered = renderTemplate("post_published", {
      postTitle: "<script>alert(1)</script>",
      postUrl: "https://example.com/p/1",
    });

    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("renders every declared template with a subject and a text part", () => {
    for (const template of Object.keys(TEMPLATE_PREFERENCE) as Array<keyof typeof TEMPLATE_PREFERENCE>) {
      const rendered = renderTemplate(template, { workspaceName: "Acme" });
      expect(rendered.subject.length, template).toBeGreaterThan(0);
      expect(rendered.text.length, template).toBeGreaterThan(0);
      expect(rendered.html, template).toContain("Zybble");
    }
  });

  it("never renders an invented metric into the reminder template", () => {
    const rendered = renderTemplate("post_reminder", {
      postTitle: "Quarterly update",
      scheduledAt: "2030-01-01T09:30:00Z",
    });

    expect(rendered.html).toContain("Quarterly update");
    expect(rendered.html).not.toMatch(/best time|guaranteed|impressions/i);
  });
});
