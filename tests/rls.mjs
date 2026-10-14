/**
 * Static RLS and authorization contract tests.
 *
 * **These are static analysis, not a live database test.** They parse the
 * migration files and the server-action sources and assert structural
 * invariants. They cannot prove a policy behaves correctly at runtime — that
 * needs a real Postgres and three real sessions (anonymous, learner A, learner
 * B), and is recorded as an open gap in `LAUNCH_BLOCKERS.md` §6.
 *
 * What they *do* catch is the failure mode static analysis is actually good at:
 * a table that is granted to a browser role but has no policy, a permissive
 * `true` where an owner check belongs, or a server action that never checks the
 * session. Every one of those is silent until a migration is applied.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

const readMigration = (name) => fs.readFileSync(path.join(MIGRATIONS, name), "utf8");

const schemaSql = readMigration("20260101000200_schema.sql");
const rlsSql =
  readMigration("20260101000300_rls.sql") + readMigration("20260101000500_learner_rls_policies.sql");

/** Tables a browser role (anon / authenticated) is allowed to touch at all. */
const grantedTables = () => new Set(rlsSql.match(/grant\s+[^;]*?\bon public\.([a-z_]+)\s+to/gi)?.map((m) => m.match(/public\.([a-z_]+)/i)[1]) ?? []);

const policiedTables = () =>
  new Set(rlsSql.match(/create policy\s+\w+\s+on public\.([a-z_]+)/gi)?.map((m) => m.match(/public\.([a-z_]+)/i)[1]) ?? []);

const declaredTables = () =>
  new Set(schemaSql.match(/create table if not exists public\.([a-z_]+)/gi)?.map((m) => m.match(/public\.([a-z_]+)/i)[1]) ?? []);

/** Policy bodies, keyed by the table they guard. */
const policyBlocks = () => {
  const blocks = new Map();
  const re = /create policy\s+(\w+)\s+on public\.([a-z_]+)([\s\S]*?);/gi;
  let match;
  while ((match = re.exec(rlsSql))) {
    const [, name, table, body] = match;
    if (!blocks.has(table)) blocks.set(table, []);
    blocks.get(table).push({ name, body });
  }
  return blocks;
};

/** Tables whose rows belong to exactly one learner. */
const LEARNER_OWNED = [
  "entitlements",
  "wishlist",
  "lesson_progress",
  "lesson_notes",
  "course_resume",
  "learner_preferences",
  "recent_course_views",
  "notifications",
];

// ===========================================================================
// The regression this file exists for
// ===========================================================================

/**
 * Objects granted to a browser role that are NOT governed by table RLS.
 *
 * A `security_invoker = false` view runs with its owner's rights, so its
 * visibility is decided entirely by the `where` clause inside the view body —
 * adding a policy to the underlying tables does not filter it. It is therefore
 * audited by the PII tests below rather than the policy-parity test, and it must
 * be listed here explicitly so that adding a second one is a deliberate act.
 *
 * Both entries are separately audited by the view tests further down: if either
 * grows a private column, those tests fail.
 */
const RLS_EXEMPT = new Set(["published_courses", "creator_public_profiles"]);

test("every table granted to a browser role has at least one RLS policy", () => {
  const granted = grantedTables();
  const policied = policiedTables();
  const unreachable = [...granted].filter((table) => !policied.has(table) && !RLS_EXEMPT.has(table));

  assert.deepEqual(
    unreachable,
    [],
    `Granted to a browser role but policied nowhere: Postgres DENIES every operation on these ` +
      `(RLS enabled + no matching policy). A new table added to the grants must get a policy too.`
  );
});

test("every RLS-exempt object really is a security_invoker = false view", () => {
  // If `published_courses` is ever switched to `security_invoker = true`, it is
  // no longer exempt — it falls back under the underlying policies and must be
  // policied like any other granted object. Fail loudly rather than silently
  // loosening the rule.
  const sql = rlsSql;
  for (const name of RLS_EXEMPT) {
    assert.ok(
      new RegExp(`with \\(?\\s*security_invoker\\s*=\\s*false[\\s\\S]{0,400}?\\bas\\n[^;]*?\\b${name}\\b`, "i").test(sql) ||
        new RegExp(`create view (?:public\\.)?${name}\\b[\\s\\S]{0,600}?security_invoker\\s*=\\s*false`, "i").test(sql),
      `${name} is in RLS_EXEMPT but is not a security_invoker = false view. If its security mode ` +
        `changed it is governed by the base table policies again — remove it from RLS_EXEMPT so ` +
        `the policy-parity test covers it again.`
    );
  }
});

test("the learner-owned tables that once had no policy are now policied", () => {
  // Named explicitly so the omission cannot come back anonymously.
  const policied = policiedTables();
  for (const table of LEARNER_OWNED) {
    assert.ok(policied.has(table), `${table} has no RLS policy — it would be unreachable for every learner`);
  }
});

test("every learner-owned table scopes its policy to auth.uid()", () => {
  const blocks = policyBlocks();
  for (const table of LEARNER_OWNED) {
    const policies = blocks.get(table) ?? [];
    assert.ok(policies.length > 0, `${table} has no policy`);
    for (const policy of policies) {
      assert.match(
        policy.body,
        /auth\.uid\(\)/,
        `${table}: policy ${policy.name} does not scope to the caller`
      );
    }
  }
});

test("no learner-owned table lets the browser insert its own entitlement", () => {
  // An entitlement is what unlocks a paid course. If a browser could insert
  // one, the whole payment boundary collapses.
  const blocks = policyBlocks();
  const entitlementPolicies = blocks.get("entitlements") ?? [];
  for (const policy of entitlementPolicies) {
    const isInsert = /for insert/i.test(policy.body);
    assert.equal(
      isInsert,
      false,
      `entitlements: policy ${policy.name} allows a browser insert — access must come only from a verified payment`
    );
  }
  assert.ok(entitlementPolicies.length > 0, "entitlements has no policy at all");
});

test("no learner-owned table lets the browser fabricate a notification", () => {
  const policies = policyBlocks().get("notifications") ?? [];
  assert.ok(policies.length > 0, "notifications has no policy at all");
  for (const policy of policies) {
    assert.equal(
      /for insert/i.test(policy.body),
      false,
      `notifications: policy ${policy.name} allows a browser insert — notifications come from platform events`
    );
  }
});

// ===========================================================================
// RLS is actually enabled, everywhere
// ===========================================================================

test("RLS is enabled for every table in the public schema", () => {
  assert.match(
    rlsSql,
    /alter table public\.%I enable row level security/i,
    "the blanket RLS enablement loop is missing"
  );
  // It must iterate over pg_tables filtered to `public`, or a table in another
  // schema would silently be skipped.
  assert.match(rlsSql, /from pg_tables where schemaname = 'public'/i);
});

test("anonymous and authenticated start with no grants", () => {
  // Without these revokes, a table added later could be reachable by default.
  assert.match(rlsSql, /revoke all on all tables in schema public from anon/i);
  assert.match(rlsSql, /revoke all on all tables in schema public from authenticated/i);
});

// ===========================================================================
// Privilege escalation
// ===========================================================================

test("profiles.role is protected against self-promotion", () => {
  // Two independent guards, because one is not enough:
  //   1. a column-level REVOKE that removes write access to `role`
  //   2. a BEFORE UPDATE trigger that raises an exception outright
  assert.match(
    rlsSql,
    /revoke update \(role\) on public\.profiles|revoke update\s*\(\s*role\s*\)/i,
    "profiles.role has no column-level revoke"
  );
  assert.match(
    rlsSql,
    /create trigger[\s\S]{0,400}before update on public\.profiles/i,
    "profiles has no BEFORE UPDATE role guard trigger"
  );
  // The trigger must actually refuse the write, not merely run.
  assert.match(
    rlsSql,
    /new\.role is distinct from old\.role[\s\S]{0,400}?raise exception/i,
    "the profiles role guard trigger does not raise on a role change"
  );
});

test("the admin audit log is not writable by a browser", () => {
  const policies = policyBlocks().get("admin_audit_log") ?? [];
  // Guard against a vacuous pass: deleting every policy would also satisfy a
  // "none of them allow writes" loop.
  assert.ok(policies.length > 0, "admin_audit_log has no policy at all — is the table still granted to anyone?");
  for (const policy of policies) {
    assert.doesNotMatch(policy.body, /for (insert|update|delete)/i, `admin_audit_log: ${policy.name} is writable`);
  }
});

test("the financial ledger has no browser write path", () => {
  assert.ok(
    !/grant[^;]*\b(insert|update|delete|all)\b[^;]*\bon public\.ledger_entries\s+to\s+(anon|authenticated)/i.test(rlsSql),
    "ledger_entries is writable by a browser role"
  );
  assert.ok(
    !/grant[^;]*\b(insert|update|delete|all)\b[^;]*\bon public\.payments\s+to\s+(anon|authenticated)/i.test(rlsSql),
    "payments is writable by a browser role"
  );
  // SELECT on `payments` is intentional: the learner's own order history has to
  // render its own payment method. It is safe only because no policy lets a
  // browser read anybody else's payment, so assert that directly instead of
  // banning the grant outright.
  assert.ok(
    /grant\s+select[^;]*\bon public\.payments\s+to\s+authenticated/i.test(rlsSql),
    "expected an explicit read-only grant on payments for the learner's order history"
  );
  const paymentPolicies = policyBlocks().get("payments") ?? [];
  assert.ok(paymentPolicies.length > 0, "payments has no policy at all — is the grant still correct?");
  for (const policy of paymentPolicies) {
    assert.doesNotMatch(policy.body, /for (insert|update|delete)/i, `payments: ${policy.name} is writable`);
  }
  // And the read is scoped: the learner may see their own payment, never
  // somebody else's. A policy missing `auth.uid()` would open the whole table.
  for (const policy of paymentPolicies) {
    assert.match(policy.body, /auth\.uid\(\)/, `payments: policy ${policy.name} is not scoped to the caller`);
  }
});

// ===========================================================================
// The public catalog view
// ===========================================================================

test("published_courses is restricted to published rows and carries no PII", () => {
  const view = rlsSql.match(/create view public\.published_courses[\s\S]*?;/i)?.[0];
  assert.ok(view, "published_courses view is missing");
  assert.match(view, /where c\.status = 'published'/i, "the view does not filter to published courses");
  assert.match(view, /security_invoker = false/i, "the view's security mode changed — re-verify its exposure");

  // A view is the classic place for an accidental PII leak, because RLS never
  // touches it.
  const columns = view.match(/^\s+(?:c|cat|cp|co)\.[a-z_]+/gim)?.map((c) => c.split(".").pop()) ?? [];
  for (const forbidden of ["email", "user_id", "full_name", "password", "phone"]) {
    assert.ok(
      !columns.includes(forbidden),
      `published_courses exposes ${forbidden}; it is readable by anon and bypasses RLS`
    );
  }
});

// ===========================================================================
// The creator profile / Route-account split
// ===========================================================================

test("no table readable by anon contains a Razorpay Route identifier", () => {
  // `route_account_id` is a live financial-account identifier belonging to a
  // real, KYC'd entity. RLS filters rows, not columns, so a `using (true)` read
  // policy on a table that holds both public profile fields and Route state
  // publishes it to the whole internet. That is what this file's predecessor
  // bug did: `creator_profiles` was `select` to `anon` with `using (true)`.
  const anonTables = [...rlsSql.matchAll(/grant\s+select[^;]*?\bon public\.([a-z_]+)\s+to\s+[^;]*?\banon\b/gi)].map(
    (m) => m[1]
  );

  assert.ok(anonTables.length > 0, "no table is readable by anon — the catalog would be empty for signed-out visitors");

  for (const table of anonTables) {
    const definition = schemaSql.match(
      new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i")
    );
    if (!definition) continue; // a view, covered by its own test
    for (const forbidden of ["route_account_id", "route_settlement_verified", "route_error"]) {
      assert.ok(
        !new RegExp(`\\b${forbidden}\\b`, "i").test(definition[1]),
        `${table} is readable by anon and holds ${forbidden}. Move the public fields to ` +
          `${table === "creator_profiles" ? "creator_public_profiles" : "a public view"} and revoke the anon grant.`
      );
    }
  }
});

test("creator_profiles is not readable by anon", () => {
  assert.ok(
    !/grant\s+select\s+on public\.creator_profiles\s+to[^;]*\banon\b/i.test(rlsSql),
    "creator_profiles is readable by anon; it holds route_account_id for every creator"
  );
  // An authenticated creator may read their own row — and only their own.
  const policies = policyBlocks().get("creator_profiles") ?? [];
  const readPolicies = policies.filter((p) => /for select|for all/i.test(p.body));
  assert.ok(readPolicies.length > 0, "creator_profiles has no select policy");
  for (const policy of readPolicies) {
    assert.match(
      policy.body,
      /user_id\s*=\s*auth\.uid\(\)/,
      `creator_profiles: policy ${policy.name} is not scoped to the caller — it would publish Route state`
    );
  }
});

test("creator_public_profiles exposes only presentable fields", () => {
  const view = rlsSql.match(/create view public\.creator_public_profiles[\s\S]*?;/i)?.[0];
  assert.ok(view, "creator_public_profiles view is missing");
  assert.match(view, /security_invoker = false/i, "the view's security mode changed — re-verify its exposure");

  const columns = view.match(/^\s+(?:cp|c)\.[a-z_]+/gim)?.map((c) => c.split(".").pop()) ?? [];
  assert.ok(columns.length > 0, "could not parse the view's column list");

  // Route state is the whole reason this view exists, so check it explicitly
  // rather than hoping a substring match notices.
  for (const forbidden of [
    "route_account_id",
    "route_account_status",
    "route_settlement_verified",
    "route_error",
    "onboarding_status",
    "email",
  ]) {
    assert.ok(
      !columns.includes(forbidden),
      `creator_public_profiles exposes ${forbidden}; it is readable by anon and bypasses RLS`
    );
  }
  // The fields the public instructor page and catalogue search actually need.
  for (const required of ["username", "display_name"]) {
    assert.ok(columns.includes(required), `creator_public_profiles no longer exposes ${required}`);
  }
});

test("public creator reads go through the view, not the table", () => {
  // Catches the regression where someone "simplifies" a public read back to
  // `creator_profiles` and silently reintroduces the anon grant requirement.
  const publicSites = ["src/lib/server/catalog.ts", "src/app/api/catalog/search/route.ts"];
  for (const file of publicSites) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(
      source,
      /\.from\("creator_profiles"\)/,
      `${file} reads creator_profiles directly. A public read must use creator_public_profiles.`
    );
  }
});

test("no policy is a bare `using (true)` on a table holding private fields", () => {
  // The specific shape of the defect this branch fixed. RLS cannot filter
  // columns, so `using (true)` on a mixed table publishes the private half.
  const MIXED = new Set(["creator_profiles"]);
  for (const [table, policies] of policyBlocks()) {
    if (!MIXED.has(table)) continue;
    for (const policy of policies) {
      assert.doesNotMatch(
        policy.body,
        /using\s*\(\s*true\s*\)/i,
        `${table}: ${policy.name} is ` + "`using (true)`" + ` — this table holds route_account_id`
      );
    }
  }
});

test("a policy predicate is never tautological", () => {
  // `using (true or auth.uid() is not null)` is a total bypass that still
  // *contains* `auth.uid()`, so a naive "does it mention auth.uid()" check
  // waves it through. Every USING / WITH CHECK must reference a real column.
  const tautologies = [
    /using\s*\(\s*true\s*\)/i,
    /using\s*\(\s*true\s+or\b/i,
    /using\s*\([^)]*\bor\b[^)]*\btrue\s*\)/i,
    /with\s+check\s*\(\s*true\s*\)/i,
    /using\s*\(\s*auth\.uid\(\)\s+is\s+not\s+null\s*\)/i,
    /with\s+check\s*\(\s*auth\.uid\(\)\s+is\s+not\s+null\s*\)/i,
  ];
  for (const [table, policies] of policyBlocks()) {
    for (const policy of policies) {
      for (const pattern of tautologies) {
        assert.doesNotMatch(
          policy.body,
          pattern,
          `${table}: ${policy.name} has a tautological predicate — RLS would allow every row`
        );
      }
    }
  }
});

// ===========================================================================
// Server actions are authorized
// ===========================================================================

const ACTION_FILES = [
  "src/app/(learner)/actions.ts",
  "src/app/creator/actions.ts",
  "src/app/admin/actions.ts",
  "src/app/(auth)/actions.ts",
];

const GUARDS = ["requireSession", "requireCreator", "requireAdmin"];

/**
 * Actions that are *supposed* to be reachable without a session.
 *
 *   - sign-in / sign-up: a session guard would be circular — this *is* the
 *     session being created.
 *   - sign-out: only clears the caller's own cookie and redirects. Guarding it
 *     would change nothing except turning a harmless idempotent call into an
 *     error for an already-signed-out visitor.
 *   - password reset: Supabase's reset link is opened while signed out, so the
 *     request action cannot require a session either.
 *
 * `updatePasswordAction` is the different case and is listed separately below:
 * it performs a *privileged* operation, but Supabase itself is the authorization
 * boundary — `auth.updateUser` succeeds only while the caller holds the
 * recovery session minted by the reset link, and fails closed otherwise.
 *
 * They are exempt here and covered instead by "the unauthenticated auth entry
 * points never reach a privileged table".
 */
const UNGUARDED_BY_DESIGN = new Set([
  "signInAction",
  "signUpAction",
  "signOutAction",
  "requestPasswordResetAction",
  "updatePasswordAction",
]);

/** Actions that change authentication state rather than application data. */
const AUTH_ONLY = new Set(["updatePasswordAction"]);

/** Splits a module into its exported async functions and their bodies. */
const exportedActions = (source) =>
  [...source.matchAll(/^export async function (\w+)\s*\(/gm)].map((m) => {
    const start = m.index;
    const end = source.indexOf("\n}", start);
    return { name: m[1], body: source.slice(start, end === -1 ? undefined : end) };
  });

for (const file of ACTION_FILES) {
  test(`${file}: every exported action checks the session`, () => {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    const actions = exportedActions(source);

    assert.ok(actions.length > 0, `no actions found in ${file}`);

    for (const action of actions) {
      if (UNGUARDED_BY_DESIGN.has(action.name)) continue;
      const guarded = GUARDS.some((guard) => action.body.includes(guard));
      assert.ok(guarded, `${file}:${action.name} has no session guard (${GUARDS.join(" / ")})`);
    }
  });
}

test("the exemption list only contains actions that really are unauthenticated", () => {
  // Prevents a real action being waved through by a stale name.
  const source = fs.readFileSync(path.join(ROOT, "src/app/(auth)/actions.ts"), "utf8");
  const names = new Set(exportedActions(source).map((a) => a.name));
  for (const name of UNGUARDED_BY_DESIGN) {
    assert.ok(names.has(name), `UNGUARDED_BY_DESIGN lists ${name}, which no longer exists in the auth actions`);
  }
});

test("the unauthenticated auth entry points never reach a privileged table", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/app/(auth)/actions.ts"), "utf8");
  const privileged = [
    "ledger_entries",
    "payments",
    "entitlements",
    "admin_audit_log",
    "creator_profiles",
    "platform_admins",
    "profile_uploads",
  ];
  const actions = exportedActions(source);
  for (const action of actions) {
    if (!UNGUARDED_BY_DESIGN.has(action.name)) continue;
    for (const table of privileged) {
      assert.doesNotMatch(
        action.body,
        new RegExp(`from\\(["'\`]${table}["'\`]\\)`),
        `${action.name} touches the privileged table ${table} without a session`
      );
    }
    // An exempt action must not touch the app schema at all beyond a plain
    // `profiles` read of its own row.
    const tables = action.body.match(/\.from\("([a-z_]+)"\)/g)?.map((t) => t.slice(7, -2)) ?? [];
    for (const table of tables) {
      assert.ok(
        AUTH_ONLY.has(action.name) ? table === "profiles" : true,
        `${action.name} queries ${table} from an unauthenticated action`
      );
      assert.ok(!["courses", "orders", "course_sections", "lessons"].includes(table), `${action.name} writes app data`);
    }
  }
});

test("updatePasswordAction leans on Supabase's recovery session, not a local check", () => {
  // The exemption above is only sound while Supabase is the one refusing an
  // un-recovered caller. If this action is ever changed to read or write app
  // tables directly, the exemption no longer holds.
  const source = fs.readFileSync(path.join(ROOT, "src/app/(auth)/actions.ts"), "utf8");
  const action = exportedActions(source).find((a) => a.name === "updatePasswordAction");
  assert.ok(action, "updatePasswordAction no longer exists");
  assert.match(action.body, /auth\.updateUser\(\{[\s\S]*?password/, "updatePasswordAction no longer uses auth.updateUser");
  assert.doesNotMatch(action.body, /createServiceClient/, "updatePasswordAction must not use the service role");
});

test("an admin action never trusts a role supplied by the client", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/app/admin/actions.ts"), "utf8");
  // The acting role must come from `requireAdmin()`'s return value, never from
  // a parsed field on the request.
  assert.doesNotMatch(source, /role:\s*z\.enum\(\["(admin|moderator)"\]\)/i);
  assert.doesNotMatch(source, /parsed\.data\.role\b/);
});

test("the learner actions never take a user id from the client", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/app/(learner)/actions.ts"), "utf8");
  // Every row filter must use the verified session id.
  const clientSuppliedUserId = /\.eq\(\s*["']user_id["']\s*,\s*(input|parsed|body|params)/gi;
  assert.doesNotMatch(source, clientSuppliedUserId, "a learner action scopes a query with a client-supplied user id");
});

test("no server action is reachable without the session guard being first", () => {
  // A guard after a side effect is not a guard. Assert that in every action the
  // session check precedes the first database write.
  for (const file of ACTION_FILES) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    const actions = [...source.matchAll(/^export async function (\w+)\s*\(/gm)].map((m) => {
      const start = m.index;
      const end = source.indexOf("\n}", start);
      return { name: m[1], body: source.slice(start, end === -1 ? undefined : end) };
    });

    for (const action of actions) {
      const guardIndex = GUARDS.map((g) => action.body.indexOf(g)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
      if (guardIndex === undefined) continue;

      const writeIndex = action.body.search(/\.(insert|upsert|update|delete)\(/);
      if (writeIndex === -1) continue;

      assert.ok(
        guardIndex < writeIndex,
        `${file}:${action.name} performs a write (offset ${writeIndex}) before its session guard (offset ${guardIndex})`
      );
    }
  }
});

// ===========================================================================
// Ownership checks in the studio and the portal
// ===========================================================================

test("creator mutations re-check that the caller owns the course", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/app/creator/actions.ts"), "utf8");

  // `assertOwnsCourse` is the shared ownership check. It has to be a real query,
  // or every caller that delegates to it is checking nothing.
  const helper = source.match(/async function assertOwnsCourse[\s\S]*?\n}/)?.[0];
  assert.ok(helper, "assertOwnsCourse is gone; the ownership model changed and needs a review");
  assert.match(helper, /from\("courses"\)\.select\("creator_id"\)/, "assertOwnsCourse no longer reads the course owner");
  assert.match(helper, /creator_id\s*!==\s*userId/, "assertOwnsCourse no longer compares the owner to the caller");

  // Any action that touches an existing course must establish ownership first,
  // either inline or through the helper. `saveCourse` is excluded: it creates a
  // new course and has no owner to check yet.
  const actions = exportedActions(source);
  const courseScoped = actions.filter((a) => {
    if (a.name === "saveCourse") return false;
    const signature = a.body.slice(0, a.body.indexOf("{") === -1 ? undefined : a.body.indexOf("{"));
    const touchesCourseId = /\bcourseId\b/.test(a.body) || /courseId:/.test(signature);
    const writesCourseTree = /from\("(courses|course_sections|lessons|course_resources)"\)/.test(a.body);
    return touchesCourseId && writesCourseTree;
  });

  assert.ok(
    courseScoped.length >= 7,
    `expected the course-scoped mutations to still exist, found ${courseScoped.length}: ${courseScoped.map((a) => a.name).join(", ")}`
  );

  for (const action of courseScoped) {
    assert.match(
      action.body,
      /assertOwnsCourse\([^)]*session\.id|creator_id\s*!==\s*session\.id/,
      `creator action ${action.name} does not verify ownership of the course`
    );
    // And the check has to precede the write.
    const guard = Math.min(
      ...[action.body.indexOf("assertOwnsCourse("), action.body.search(/creator_id\s*!==\s*session\.id/)]
        .filter((i) => i >= 0)
    );
    const write = action.body.search(/\.(insert|upsert|update|delete)\(/);
    if (write !== -1) {
      assert.ok(guard !== -1 && guard < write, `${action.name} writes before it checks ownership`);
    }
  }
});

test("every privileged action writes an audit record", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/app/admin/actions.ts"), "utf8");

  /**
   * Some privileged work is delegated to a library function that writes its own
   * audit row from the service role. Those are legitimate, but the delegation
   * must be explicit so it is a decision rather than an accident.
   */
  const AUDITED_ELSEWHERE = {
    refundOrderAction: {
      delegate: /await refundOrder\(/,
      // The audit must name the acting admin and the order, not be anonymous.
      evidence: /from\("admin_audit_log"\)\.insert\(/,
      evidenceFile: path.join(ROOT, "src/lib/server/checkout.ts"),
    },
  };

  const actions = [...source.matchAll(/^export (?:async )?function (\w+)\s*\(/gm)]
    .map((m) => m[1])
    // Reads and pure helpers are exempt.
    .filter((name) => !/^(get|fail|audit|verify|is|has|default)/i.test(name) && !name.startsWith("get"));

  for (const name of actions) {
    const start = source.indexOf(`export async function ${name}(`);
    if (start === -1) continue;
    const end = source.indexOf("\n}", start);
    const body = source.slice(start, end === -1 ? undefined : end);

    if (AUDITED_ELSEWHERE[name]) {
      const { delegate, evidence, evidenceFile } = AUDITED_ELSEWHERE[name];
      assert.match(body, delegate, `${name} no longer delegates to the audited helper`);
      assert.match(
        fs.readFileSync(evidenceFile, "utf8"),
        evidence,
        `${name} delegates to a helper that no longer writes admin_audit_log`
      );
      continue;
    }

    assert.match(body, /await audit\(/, `admin action ${name} performs a mutation with no audit record`);
  }
});

// ===========================================================================
// Migrations are ordered and complete
// ===========================================================================

test("migrations are numbered so they apply in order", () => {
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(files.length >= 4, `expected at least 4 migrations, found ${files.length}`);
  const timestamps = files.map((f) => f.slice(0, 14));
  assert.deepEqual(timestamps, [...timestamps].sort(), "migration filenames are not in timestamp order");
});

test("every table declared in the schema is enabled for RLS by the blanket loop", () => {
  // The loop is dynamic, so this asserts the loop's own predicate rather than
  // enumerating: the failure it guards against is someone narrowing the loop's
  // WHERE clause to a single table.
  const loop = rlsSql.match(/do \$\$[\s\S]*?end \$\$;/)?.[0];
  assert.ok(loop, "the blanket RLS loop is missing");
  assert.doesNotMatch(loop, /limit\s+\d/i, "the RLS loop skips tables");
  assert.equal(declaredTables().size > 30, true, "expected a substantial schema");
});