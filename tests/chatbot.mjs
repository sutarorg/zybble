/**
 * Contract tests for Zybble AI.
 *
 * These cover the parts that must never regress: which routes may show the
 * assistant, how the catalog is grounded, and the guarantee that a slug the
 * model invents is dropped instead of rendered.
 *
 * `src/lib/server/ai.ts` is `server-only`, so it is imported through a tiny
 * resolution shim that stubs the marker — the pure functions under test touch
 * no network and no database.
 */
import assert from "node:assert/strict";
import { test, before } from "node:test";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

/* --- resolve the `@/` alias and neutralise `server-only` for this harness --- */

before(async () => {
  register(
    new URL("./helpers/loader.mjs", import.meta.url),
    pathToFileURL("./")
  );
});

const { isChatbotPage, MAX_MESSAGE_CHARS, MAX_CONVERSATION_ENTRIES } = await import("../src/lib/chatbot.ts");
const ai = await import("../src/lib/server/ai.ts");

const catalog = [
  {
    id: "one",
    slug: "chatgpt-basics",
    title: "ChatGPT Basics",
    summary: "Learn prompting",
    category: "generative-ai",
    level: "beginner",
    pricePaise: 0,
    durationMinutes: 90,
    lessons: 8,
    instructor: "Asha Rao",
  },
  {
    id: "two",
    slug: "n8n-workflows",
    title: "n8n Workflows",
    summary: "Automate your work",
    category: "automation",
    level: "intermediate",
    pricePaise: 400000,
    durationMinutes: 180,
    lessons: 14,
    instructor: "Vikram S",
  },
];

test("only public discovery routes are allowed", () => {
  for (const route of ["/", "/explore", "/categories/automation", "/categories/data-science/"]) {
    assert.equal(isChatbotPage(route), true, route);
  }
  for (const route of [
    "/dashboard",
    "/my-learning",
    "/learn/one",
    "/creator",
    "/creator/signup",
    "/creator/courses",
    "/admin/categories",
    "/checkout/one",
    "/login",
    "/help",
    "/courses/chatgpt-basics",
    "/categories/automation/edit",
    "/categories/automation/extra",
  ]) {
    assert.equal(isChatbotPage(route), false, route);
  }
});

test("a syntactically valid category route shows the launcher, existence is decided server-side", () => {
  // The browser cannot know which categories exist, so the route *shape* is all
  // it checks; the page itself 404s when the category is not in the database.
  assert.equal(isChatbotPage("/categories/unknown"), true);
});

test("message and conversation caps match the server", () => {
  assert.equal(MAX_MESSAGE_CHARS, ai.MAX_USER_MESSAGE_CHARS);
  assert.equal(MAX_CONVERSATION_ENTRIES, 60);
});

test("the prompt catalog is derived only from grounded courses, in INR", () => {
  const rendered = ai.renderCatalogForPrompt(catalog);
  assert.match(rendered, /chatgpt-basics/);
  assert.match(rendered, /n8n-workflows/);
  // INR only: never a dollar sign or a symbol outside the allowed set.
  assert.doesNotMatch(rendered, /\$/);
  assert.doesNotMatch(rendered, /\b(USD|EUR|GBP)\b/);
  assert.match(rendered, /price: free/);
  assert.match(rendered, /price: 4000 INR/);
});

test("a hallucinated slug is dropped, not rendered", () => {
  const resolved = ai.resolveRecommendations(
    ["chatgpt-basics", "totally-made-up-course", "n8n-workflows"],
    catalog
  );
  assert.deepEqual(resolved.map((course) => course.id), ["one", "two"]);
});

test("no recommendations is an honest empty answer, never an invented course", () => {
  assert.deepEqual(ai.resolveRecommendations([], catalog), []);
  assert.deepEqual(ai.resolveRecommendations(["nope"], catalog), []);
});

test("recommendations carry a server-formatted INR label", () => {
  const [free, paid] = ai.resolveRecommendations(["chatgpt-basics", "n8n-workflows"], catalog);
  assert.equal(ai.toRecommendation(free).priceLabel, "Free");
  assert.equal(ai.toRecommendation(paid).priceLabel, "₹4,000");
});

test("a parsed assistant reply is clamped to an allow-listed same-origin link", () => {
  const escaped = ai.parseAssistantAnswer(
    JSON.stringify({ text: "Here you go", link: { href: "https://evil.example/steal", label: "Click" } })
  );
  assert.equal(escaped.link, undefined);

  const external = ai.parseAssistantAnswer(
    JSON.stringify({ text: "Here you go", link: { href: "/explore", label: "Browse" } })
  );
  // `/explore` is not in the allowlist, so the link is dropped rather than rendered.
  assert.equal(external.link, undefined);

  const allowed = ai.parseAssistantAnswer(
    JSON.stringify({ text: "Here you go", link: { href: "/help", label: "Help Center" } })
  );
  assert.deepEqual(allowed.link, { href: "/help", label: "Help Center" });
});

test("a malformed or content-free model reply fails closed", () => {
  for (const content of ["not json at all", "{}", JSON.stringify({ text: "   " })]) {
    assert.throws(() => ai.parseAssistantAnswer(content), /Zybble AI is unavailable/);
  }
});

test("model slugs are capped and non-string entries dropped", () => {
  const answer = ai.parseAssistantAnswer(
    JSON.stringify({ text: "Try these", recommended_slugs: ["chatgpt-basics", 42, null, "n8n-workflows", "extra"] })
  );
  assert.deepEqual(answer.recommendedSlugs, ["chatgpt-basics", "n8n-workflows", "extra"]);
  assert.equal(ai.resolveRecommendations(answer.recommendedSlugs, catalog).length, 2);
});

test("fallback answers disclose the failure rather than faking an answer", () => {
  for (const reason of ["unavailable", "rate_limited", "invalid_response"]) {
    const answer = ai.fallbackAnswer(reason, 0);
    assert.ok(answer.text.length > 0, reason);
    assert.ok(answer.error, reason);
    // Never invents a course, and always offers a real, allow-listed way out.
    assert.deepEqual(answer.recommendedSlugs ?? [], []);
    assert.equal(answer.link?.href, "/help");
  }
});