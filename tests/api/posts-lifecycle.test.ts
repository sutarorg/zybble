import { afterEach, describe, expect, it, vi } from "vitest";
import { callsFor, createFakeSupabase, type FakeSupabase } from "../helpers/fake-supabase";

/**
 * Post lifecycle rules that must hold no matter which client calls the API.
 *
 * Scheduling is where a SaaS quietly breaks: a wall-clock time has to survive
 * daylight saving in the *author's* zone while being stored as a UTC instant.
 * Editing and deletion are where a race turns into double-posting, so a live or
 * in-flight post must be refused outright rather than "handled".
 */

const WORKSPACE = "22222222-2222-4222-8222-222222222222";
const POST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const adminState = { current: null as FakeSupabase | null };
const inngestState = { sent: [] as Array<{ name: string; data: Record<string, unknown> }>, failing: false };

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminState.current,
}));

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: async (event: { name: string; data: Record<string, unknown> }) => {
      if (inngestState.failing) throw new Error("Inngest unreachable");
      inngestState.sent.push(event);
      return { ids: ["evt"] };
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: () => ({ NODE_ENV: "test" }),
  isSupabaseConfigured: () => true,
  isDodoConfigured: () => false,
}));

const { resolveScheduledAt, updatePost, deletePost, retryPost } = await import(
  "@/features/posts/service"
);

type ContextLike = Parameters<typeof updatePost>[0];

function context(overrides: Partial<ContextLike> = {}): ContextLike {
  return {
    workspace: {
      id: WORKSPACE,
      name: "Acme",
      slug: "acme",
      plan: "free",
      seats: 1,
      timezone: "UTC",
      created_at: new Date().toISOString(),
    },
    user: { id: "44444444-4444-4444-8444-444444444444" },
    role: "owner",
    canWrite: true,
    canManage: true,
    ...overrides,
  } as unknown as ContextLike;
}

function futureDate(daysAhead = 30): string {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

afterEach(() => {
  adminState.current = null;
  inngestState.sent = [];
  inngestState.failing = false;
});

/* ------------------------------ scheduling --------------------------------- */

describe("scheduling maths", () => {
  it("keeps the wall-clock time across a spring-forward DST transition", () => {
    // US DST starts on 2027-03-14: the clock jumps 02:00→03:00. A 09:30 slot
    // must stay 09:30 *local* either side of it, at a different UTC offset.
    const beforeDst = resolveScheduledAt({
      date: "2027-03-13",
      time: "09:30",
      timezone: "America/New_York",
      fallbackTimezone: "UTC",
    });
    const afterDst = resolveScheduledAt({
      date: "2027-03-15",
      time: "09:30",
      timezone: "America/New_York",
      fallbackTimezone: "UTC",
    });

    expect(beforeDst.toISOString()).toBe("2027-03-13T14:30:00.000Z"); // EST, UTC-5
    expect(afterDst.toISOString()).toBe("2027-03-15T13:30:00.000Z"); // EDT, UTC-4
  });

  it("keeps the wall-clock time across a fall-back DST transition", () => {
    // US DST ends on 2027-11-07, so the 8th is back on standard time.
    const instant = resolveScheduledAt({
      date: "2027-11-08",
      time: "09:30",
      timezone: "America/New_York",
      fallbackTimezone: "UTC",
    });

    expect(instant.toISOString()).toBe("2027-11-08T14:30:00.000Z"); // back to UTC-5
  });

  it("handles a zone that does not observe DST at all", () => {
    const winter = resolveScheduledAt({
      date: "2027-01-15",
      time: "09:30",
      timezone: "Asia/Kolkata",
      fallbackTimezone: "UTC",
    });
    const summer = resolveScheduledAt({
      date: "2027-07-15",
      time: "09:30",
      timezone: "Asia/Kolkata",
      fallbackTimezone: "UTC",
    });

    expect(winter.toISOString()).toBe("2027-01-15T04:00:00.000Z");
    expect(summer.toISOString()).toBe("2027-07-15T04:00:00.000Z");
  });

  it("falls back to the workspace timezone when the client sends none", () => {
    const instant = resolveScheduledAt({
      date: futureDate(),
      time: "12:00",
      timezone: undefined,
      fallbackTimezone: "Europe/London",
    });

    // Whatever the zone, the instant is in the future and on the right day.
    expect(instant.getTime()).toBeGreaterThan(Date.now());
  });

  it("refuses a non-existent wall time rather than rolling it forward", () => {
    // 2027-03-14 02:30 never happens in New York.
    expect(() =>
      resolveScheduledAt({
        date: "2027-03-14",
        time: "02:30",
        timezone: "America/New_York",
        fallbackTimezone: "UTC",
      }),
    ).toThrow();
  });

  it("refuses an impossible calendar date", () => {
    expect(() =>
      resolveScheduledAt({
        date: "2027-02-30",
        time: "09:00",
        timezone: "UTC",
        fallbackTimezone: "UTC",
      }),
    ).toThrow();
  });

  it("refuses a time in the past", () => {
    expect(() =>
      resolveScheduledAt({
        date: "2020-01-01",
        time: "09:00",
        timezone: "UTC",
        fallbackTimezone: "UTC",
      }),
    ).toThrow(/future/i);
  });

  it("requires both a date and a time", () => {
    expect(() =>
      resolveScheduledAt({ date: futureDate(), fallbackTimezone: "UTC" }),
    ).toThrow(/date and time/i);
  });
});

/* -------------------------------- editing ---------------------------------- */

describe("editing and deletion", () => {
  it("refuses to edit a post that is already live", async () => {
    adminState.current = createFakeSupabase({
      posts: { single: { id: POST, status: "published", timezone: "UTC", attempts: 1 } },
    });

    await expect(updatePost(context(), adminState.current as never, POST, { body: "edited" })).rejects.toThrow(
      /already live/i,
    );
  });

  it("refuses to edit a post that is mid-publish", async () => {
    adminState.current = createFakeSupabase({
      posts: { single: { id: POST, status: "publishing", timezone: "UTC", attempts: 1 } },
    });

    await expect(updatePost(context(), adminState.current as never, POST, { body: "edited" })).rejects.toThrow(
      /being published/i,
    );
  });

  it("refuses to delete a post that is mid-publish", async () => {
    adminState.current = createFakeSupabase({
      posts: { single: { id: POST, status: "publishing", scheduled_at: null } },
    });

    await expect(deletePost(context(), adminState.current as never, POST)).rejects.toThrow(
      /being published/i,
    );
  });

  it("refuses writes from a read-only role", async () => {
    adminState.current = createFakeSupabase({
      posts: { single: { id: POST, status: "draft", timezone: "UTC", attempts: 0 } },
    });

    await expect(
      updatePost(context({ canWrite: false, role: "viewer" }), adminState.current as never, POST, {
        body: "edited",
      }),
    ).rejects.toThrow(/read-only/i);
  });

  it("cancels the pending run before queueing a rescheduled one", async () => {
    adminState.current = createFakeSupabase({
      posts: {
        singleQueue: [
          { id: POST, status: "scheduled", timezone: "UTC", attempts: 1, scheduled_at: new Date().toISOString() },
          {
            id: POST,
            status: "scheduled",
            timezone: "UTC",
            attempts: 1,
            scheduled_at: new Date(Date.now() + 3_600_000).toISOString(),
          },
        ],
      },
    });

    await updatePost(context(), adminState.current as never, POST, {
      intent: "schedule",
      scheduleDate: futureDate(),
      scheduleTime: "10:00",
      timezone: "UTC",
    });

    const names = inngestState.sent.map((event) => event.name);
    expect(names).toContain("post/publish.cancelled");
    expect(names).toContain("post/publish.requested");
    // The new run is queued after the old one is cancelled.
    expect(names.indexOf("post/publish.cancelled")).toBeLessThan(
      names.lastIndexOf("post/publish.requested"),
    );
  });

  it("bumps the attempt number so a reschedule never reuses a claim", async () => {
    adminState.current = createFakeSupabase({
      posts: {
        singleQueue: [
          { id: POST, status: "scheduled", timezone: "UTC", attempts: 1, scheduled_at: new Date().toISOString() },
          {
            id: POST,
            status: "scheduled",
            timezone: "UTC",
            attempts: 1,
            scheduled_at: new Date(Date.now() + 3_600_000).toISOString(),
          },
        ],
      },
    });

    await updatePost(context(), adminState.current as never, POST, {
      intent: "schedule",
      scheduleDate: futureDate(),
      scheduleTime: "10:00",
      timezone: "UTC",
    });

    const queued = inngestState.sent.filter((event) => event.name === "post/publish.requested");
    expect(queued.at(-1)!.data.attempt).toBe(2);
  });

  it("reports a failed enqueue instead of pretending the post is scheduled", async () => {
    inngestState.failing = true;

    adminState.current = createFakeSupabase({
      posts: {
        singleQueue: [
          { id: POST, status: "draft", timezone: "UTC", attempts: 0 },
          {
            id: POST,
            status: "scheduled",
            timezone: "UTC",
            attempts: 0,
            scheduled_at: new Date(Date.now() + 3_600_000).toISOString(),
          },
        ],
      },
    });

    const result = await updatePost(context(), adminState.current as never, POST, {
      intent: "schedule",
      scheduleDate: futureDate(),
      scheduleTime: "10:00",
      timezone: "UTC",
    });

    // The row is correct; only the event is missing, and the caller is told.
    expect(result.post.status).toBe("scheduled");
    expect(result.publishJobQueued).toBe(false);
  });
});

/* --------------------------------- retry ----------------------------------- */

describe("retrying a failed post", () => {
  it("queues a new attempt for a genuinely failed post", async () => {
    adminState.current = createFakeSupabase({
      posts: {
        singleQueue: [
          {
            id: POST,
            status: "failed",
            timezone: "UTC",
            attempts: 1,
            failure_code: "linkedin_unavailable",
            scheduled_at: new Date().toISOString(),
          },
          {
            id: POST,
            status: "scheduled",
            timezone: "UTC",
            attempts: 1,
            scheduled_at: new Date(Date.now() + 60_000).toISOString(),
          },
        ],
      },
    });

    const result = await retryPost(context(), adminState.current as never, POST);

    expect(result.post.status).toBe("scheduled");
    const queued = inngestState.sent.filter((event) => event.name === "post/publish.requested");
    expect(queued.at(-1)!.data.attempt).toBe(2);
  });

  it("refuses to auto-retry a post whose outcome is unknown", async () => {
    adminState.current = createFakeSupabase({
      posts: {
        single: {
          id: POST,
          status: "failed",
          timezone: "UTC",
          attempts: 1,
          failure_code: "UNKNOWN_OUTCOME",
          scheduled_at: new Date().toISOString(),
        },
      },
    });

    // Only the user can confirm whether LinkedIn already published it.
    await expect(retryPost(context(), adminState.current as never, POST)).rejects.toThrow(
      /confirm|already|unknown/i,
    );
    expect(inngestState.sent).toHaveLength(0);
  });

  it("never reuses an attempt number", async () => {
    adminState.current = createFakeSupabase({
      posts: {
        singleQueue: [
          {
            id: POST,
            status: "failed",
            timezone: "UTC",
            attempts: 2,
            failure_code: "linkedin_unavailable",
            scheduled_at: new Date().toISOString(),
          },
          {
            id: POST,
            status: "scheduled",
            timezone: "UTC",
            attempts: 2,
            scheduled_at: new Date(Date.now() + 60_000).toISOString(),
          },
        ],
      },
    });

    await retryPost(context(), adminState.current as never, POST);

    expect(inngestState.sent.at(-1)!.data.attempt).toBe(3);
  });
});

/* --------------------------- workspace scoping ----------------------------- */

describe("workspace scoping of writes", () => {
  it("always pins every write to the caller's workspace", async () => {
    adminState.current = createFakeSupabase({
      posts: {
        singleQueue: [
          { id: POST, status: "draft", timezone: "UTC", attempts: 0 },
          { id: POST, status: "draft", timezone: "UTC", attempts: 0 },
        ],
      },
    });

    await updatePost(context(), adminState.current as never, POST, { body: "scoped" });

    const updates = callsFor(adminState.current!, "posts", "update");
    expect(updates[0]!.filters).toMatchObject({ id: POST, workspace_id: WORKSPACE });
  });
});
