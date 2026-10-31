import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { completeOnboardingIfNeeded, needsBackend, signUp, testEmail } from "./support/backend";

/**
 * Multi-tenant isolation, proven from the outside.
 *
 * The unit suite (`tests/db/rls-isolation.test.ts`) proves isolation at the SQL
 * layer. This suite proves it at the HTTP layer, which is the layer an attacker
 * actually reaches: two real accounts, two real workspaces, and every attempt
 * by one to touch the other's rows must come back empty or forbidden.
 */

const PASSWORD = "correct-horse-battery-staple";

type Tenant = { context: BrowserContext; page: Page; workspaceId: string };

async function createTenant(browser: Browser, label: string): Promise<Tenant> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await signUp(page, `${label} Owner`, testEmail(label), PASSWORD);
  await completeOnboardingIfNeeded(page, `${label} Workspace`);

  const current = (await (await page.request.get("/api/workspaces/current")).json()).data;
  return { context, page, workspaceId: current.workspace.id };
}

test.describe("cross-tenant isolation", () => {
  test("two workspaces cannot see each other's data", async ({ browser }) => {
    needsBackend();

    const alice = await createTenant(browser, "alice");
    const bob = await createTenant(browser, "bob");

    expect(alice.workspaceId).not.toBe(bob.workspaceId);

    // --- Workspaces -------------------------------------------------------
    const bobsWorkspaces = (await (await bob.page.request.get("/api/workspaces")).json()).data;
    const ids = bobsWorkspaces.workspaces.map((w: { id: string }) => w.id);
    expect(ids).toContain(bob.workspaceId);
    expect(ids, "Bob can see Alice's workspace").not.toContain(alice.workspaceId);

    // --- Switching to a foreign workspace must fail -----------------------
    const switchAttempt = await bob.page.request.post("/api/workspaces/switch", {
      data: { workspaceId: alice.workspaceId },
    });
    expect(switchAttempt.status()).toBe(404);

    // Even if the cookie were forced, reads must stay scoped.
    const forced = await bob.page.request.get("/api/workspaces/current", {
      headers: { "X-Workspace-Id": alice.workspaceId },
    });
    if (forced.ok()) {
      const data = (await forced.json()).data;
      expect(data.workspace.id, "X-Workspace-Id leaked another tenant").toBe(bob.workspaceId);
    }

    // --- Members ----------------------------------------------------------
    const members = await bob.page.request.get(
      `/api/workspaces/${alice.workspaceId}/members`,
    );
    expect([403, 404]).toContain(members.status());

    // --- Usage and billing ------------------------------------------------
    const usage = await bob.page.request.get(`/api/workspaces/${alice.workspaceId}/usage`);
    expect([403, 404]).toContain(usage.status());

    // --- Posts, calendar, analytics --------------------------------------
    for (const path of ["/api/posts", "/api/calendar?from=2026-01-01&to=2026-12-31", "/api/analytics?range=7d"]) {
      const response = await bob.page.request.get(path, {
        headers: { "X-Workspace-Id": alice.workspaceId },
      });

      if (!response.ok()) continue;

      const data = (await response.json()).data;
      // Whatever comes back must belong to Bob. The simplest robust check is
      // that the payload is empty for a workspace he has no posts in, and that
      // nothing carries Alice's workspace id.
      expect(JSON.stringify(data)).not.toContain(alice.workspaceId);
    }

    await alice.context.close();
    await bob.context.close();
  });

  test("a post id from another workspace resolves to 404, not 403-with-data", async ({ browser }) => {
    needsBackend();

    const alice = await createTenant(browser, "carol");
    const bob = await createTenant(browser, "dave");

    const accounts = (await (await alice.page.request.get("/api/linkedin/accounts")).json()).data;
    const accountId = accounts.accounts?.[0]?.id;

    if (accountId) {
      const created = await alice.page.request.post("/api/posts", {
        data: { authorAccountId: accountId, body: "Alice's private draft", intent: "draft" },
      });

      if (created.ok()) {
        const postId = (await created.json()).data.post.id;

        const read = await bob.page.request.get(`/api/posts/${postId}`);
        expect(read.status()).toBe(404);

        const write = await bob.page.request.patch(`/api/posts/${postId}`, { data: { body: "hijacked" } });
        expect([403, 404]).toContain(write.status());

        const del = await bob.page.request.delete(`/api/posts/${postId}`);
        expect([403, 404]).toContain(del.status());

        // And the post is untouched.
        const stillThere = await alice.page.request.get(`/api/posts/${postId}`);
        expect(stillThere.ok()).toBe(true);
      }
    }

    await alice.context.close();
    await bob.context.close();
  });

  test("a member cannot manage the workspace they only belong to", async ({ browser }) => {
    needsBackend();

    const owner = await createTenant(browser, "erin");
    const invite = await owner.page.request.post("/api/workspaces/current/members", {
      data: { email: testEmail("frank"), role: "viewer" },
    });

    // Inviting is a Pro capability; on Free this is refused, which is correct.
    if (!invite.ok()) {
      await owner.context.close();
      return;
    }

    const membership = (await invite.json()).data.member;

    // A viewer must not be able to change roles or invite others.
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await signUp(viewerPage, "Frank Viewer", testEmail("frank"), PASSWORD);
    await completeOnboardingIfNeeded(viewerPage, "Frank Workspace");

    const demote = await viewerPage.request.patch(
      `/api/workspaces/${owner.workspaceId}/members/${membership.id}`,
      { data: { role: "admin" } },
    );
    expect([403, 404]).toContain(demote.status());

    await owner.context.close();
    await viewerContext.close();
  });

  test("the service-role key is never exposed to the browser", async ({ browser }) => {
    needsBackend();
    const tenant = await createTenant(browser, "gina");

    await tenant.page.goto("/dashboard");
    await tenant.page.waitForLoadState("networkidle");

    // Inspect every script the browser actually loaded.
    const scripts = await tenant.page.evaluate(async () => {
      const urls = Array.from(document.querySelectorAll("script[src]")).map((s) =>
        (s as HTMLScriptElement).src,
      );
      const bodies: string[] = [];
      for (const url of urls) {
        try {
          bodies.push(await (await fetch(url)).text());
        } catch {
          /* ignore */
        }
      }
      return bodies.join("\n");
    });

    expect(scripts).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(scripts).not.toContain("TOKEN_ENCRYPTION_KEY");
    expect(scripts).not.toContain("DODO_PAYMENTS_API_KEY");
    expect(scripts).not.toContain("RESEND_API_KEY");
    expect(scripts).not.toContain("LINKEDIN_CLIENT_SECRET");
    expect(scripts).not.toContain("CRON_SECRET");
    // A service-role key is a JWT with `role: "service_role"`.
    expect(scripts).not.toMatch(/service_role/);

    await tenant.context.close();
  });
});
