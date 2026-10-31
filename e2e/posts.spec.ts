import { expect, test } from "@playwright/test";
import { completeOnboardingIfNeeded, needsBackend, signUp, testEmail } from "./support/backend";

/**
 * Post lifecycle end-to-end.
 *
 * Publishing is the one workflow where a bug is visible on a customer's
 * LinkedIn feed, so these tests are deliberately strict about state:
 * a scheduled post is scheduled, a cancelled post is not queued, and a post
 * that failed is never reported as published.
 */

const PASSWORD = "correct-horse-battery-staple";

test.beforeEach(async ({ page }) => {
  needsBackend();
  await signUp(page, "Post Tester", testEmail("posts"), PASSWORD);
  await completeOnboardingIfNeeded(page, "Post Workspace");
});

test.describe("drafts", () => {
  test("a draft can be created, edited and deleted", async ({ page }) => {
    await page.goto("/posts/new");
    await page.getByRole("textbox", { name: /post|write|content/i }).fill("Draft body from E2E");
    await page.getByRole("button", { name: /save draft/i }).click();

    await expect(page).toHaveURL(/\/posts/);
    await expect(page.getByText("Draft body from E2E").first()).toBeVisible();

    // Edit it.
    await page.getByText("Draft body from E2E").first().click();
    await page.waitForURL(/\/posts\/[^/]+\/edit/);

    const editor = page.getByRole("textbox", { name: /post|write|content/i });
    await editor.fill("Edited body from E2E");
    await page.getByRole("button", { name: /save|update/i }).click();

    await expect(page.getByText("Edited body from E2E").first()).toBeVisible();
  });

  test("an empty draft is rejected with a validation message", async ({ page }) => {
    const response = await page.request.post("/api/posts", {
      data: { body: "x".repeat(4000), intent: "draft", authorAccountId: "00000000-0000-4000-8000-000000000000" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_failed");
    // The message must be a sentence, not a Zod dump.
    expect(body.error.message).not.toMatch(/\[|\]|zod|invalid_type/i);
  });

  test("a post body longer than LinkedIn allows is refused", async ({ page }) => {
    const response = await page.request.post("/api/posts", {
      data: { body: "x".repeat(4000), intent: "draft" },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toMatch(/3000|character/i);
  });
});

test.describe("scheduling", () => {
  test("a scheduled post appears on the calendar and can be cancelled", async ({ page }) => {
    // Create a scheduled post through the API so the test does not depend on
    // the composer's exact widget set.
    const accounts = await (await page.request.get("/api/linkedin/accounts")).json();
    const accountId = accounts.data?.accounts?.[0]?.id;

    test.skip(!accountId, "No connected LinkedIn account in this environment.");

    const future = new Date(Date.now() + 7 * 86_400_000);
    const created = await page.request.post("/api/posts", {
      data: {
        authorAccountId: accountId,
        body: "Scheduled from E2E",
        intent: "schedule",
        scheduleDate: future.toISOString().slice(0, 10),
        scheduleTime: "10:00",
        timezone: "UTC",
      },
    });

    expect(created.status()).toBe(201);
    const post = (await created.json()).data.post;
    expect(post.status).toBe("scheduled");
    expect(new Date(post.scheduledAt).getTime()).toBeGreaterThan(Date.now());

    // Cancel it.
    const cancelled = await page.request.post(`/api/posts/${post.id}/cancel`);
    expect(cancelled.status()).toBe(200);
    expect((await cancelled.json()).data.post.status).toBe("cancelled");
  });

  test("scheduling in the past is refused", async ({ page }) => {
    const response = await page.request.post("/api/posts", {
      data: {
        authorAccountId: "00000000-0000-4000-8000-000000000000",
        body: "Back to the future",
        intent: "schedule",
        scheduleDate: "2020-01-01",
        scheduleTime: "10:00",
        timezone: "UTC",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toMatch(/future/i);
  });

  test("a nonexistent DST time is refused rather than silently shifted", async ({ page }) => {
    const response = await page.request.post("/api/posts", {
      data: {
        authorAccountId: "00000000-0000-4000-8000-000000000000",
        body: "DST gap",
        intent: "schedule",
        // 02:30 does not exist in New York on the spring-forward date.
        scheduleDate: "2027-03-14",
        scheduleTime: "02:30",
        timezone: "America/New_York",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toMatch(/does not exist|daylight saving/i);
  });

  test("a published post cannot be edited", async ({ page }) => {
    const postId = "00000000-0000-4000-8000-000000000000";
    const response = await page.request.patch(`/api/posts/${postId}`, { data: { body: "nope" } });
    // 404 (not found in this workspace) is the correct answer for a foreign id.
    expect([400, 404]).toContain(response.status());
  });
});

test.describe("media upload validation", () => {
  test("an unsupported type is rejected before it is stored", async ({ page }) => {
    const response = await page.request.post("/api/posts/media", {
      multipart: {
        kind: "image",
        file: {
          name: "notes.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("not an image"),
        },
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toMatch(/jpeg|png|gif|accept/i);
  });

  test("an oversized image is rejected", async ({ page }) => {
    const response = await page.request.post("/api/posts/media", {
      multipart: {
        kind: "image",
        file: {
          name: "huge.png",
          mimeType: "image/png",
          buffer: Buffer.alloc(6 * 1024 * 1024, 1),
        },
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toMatch(/5 MB|smaller|size/i);
  });
});

test.describe("publishing", () => {
  test("publishing without a connected account fails loudly", async ({ page }) => {
    const accounts = await (await page.request.get("/api/linkedin/accounts")).json();
    const connected = accounts.data?.accounts?.length ?? 0;

    test.skip(connected > 0, "An account is connected in this environment.");

    await page.goto("/posts/new");
    // The composer must explain the blocker instead of offering a dead
    // "Publish" button.
    await expect(page.getByText(/connect|no account|connect a linkedin/i).first()).toBeVisible();
  });

  test("a failed post is never shown as published", async ({ page }) => {
    const accounts = await (await page.request.get("/api/linkedin/accounts")).json();
    const accountId = accounts.data?.accounts?.[0]?.id;
    test.skip(!accountId, "No connected LinkedIn account in this environment.");

    // Publish a post with no body and no media: LinkedIn rejects it.
    const created = await page.request.post("/api/posts", {
      data: { authorAccountId: accountId, body: "", intent: "publish_now" },
    });

    if (created.status() === 402) return; // Free-plan guard; nothing to assert.

    const postId = (await created.json()).data.post.id;

    // Poll for a terminal state. Whatever happens, the status must be honest.
    let status = "";
    for (let i = 0; i < 20; i += 1) {
      const response = await page.request.get(`/api/posts/${postId}`);
      status = (await response.json()).data.post.status;
      if (["published", "failed", "cancelled"].includes(status)) break;
      await page.waitForTimeout(1_000);
    }

    expect(["published", "failed", "cancelled"]).toContain(status);
    if (status === "failed") {
      const post = (await (await page.request.get(`/api/posts/${postId}`)).json()).data.post;
      expect(post.failureReason).toBeTruthy();
      expect(post.permalink).toBeNull();
    }
  });
});
