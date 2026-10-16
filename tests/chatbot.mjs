/**
 * Contract tests for Zybble 2.0.
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

// `serverEnv` is built once at module load, so the key must exist before the
// import below. It is a stand-in: no test here reaches OpenRouter.
process.env.OPENROUTER_API_KEY ||= "test-key-not-a-credential";

const {
  isChatbotPage,
  MAX_MESSAGE_CHARS,
  MAX_CONVERSATION_ENTRIES,
  ASSISTANT_NAME,
  WELCOME_MESSAGE,
  PLATFORM_KNOWLEDGE,
} = await import("../src/lib/chatbot.ts");
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

test("the assistant is Zybble 2.0 everywhere it introduces itself", () => {
  assert.equal(ASSISTANT_NAME, "Zybble 2.0");
  assert.match(WELCOME_MESSAGE, /Zybble 2\.0/);
  // The server prompt and the browser panel share one identity string.
  assert.match(ai.ASSISTANT_IDENTITY, /You are Zybble 2\.0/);
  assert.match(ai.ASSISTANT_IDENTITY, /Your name is Zybble 2\.0/);
});

test("the model is briefed on the platform, and told what it cannot do", () => {
  const system = ai.buildSystemMessage(catalog);

  // Platform knowledge the assistant is allowed to state.
  for (const fact of [
    "India-only marketplace",
    "Razorpay",
    "Indian Rupees",
    "certificate",
    "Creator Studio",
    "Help Center",
    "free previews",
  ]) {
    assert.match(system, new RegExp(fact, "i"), `platform brief is missing "${fact}"`);
  }

  // Its own limits, so it never pretends to have account access.
  assert.match(system, /cannot see accounts/i);
  assert.match(system, /no self-service refund flow/i);

  // The grounded catalog is still part of the same system message.
  assert.match(system, /CATALOG:/);
  assert.match(system, /n8n-workflows/);
});

test("the platform brief carries no secrets, prices of real courses or personal data", () => {
  assert.doesNotMatch(PLATFORM_KNOWLEDGE, /sk-or-|Bearer |service_role|API key/i);
  assert.doesNotMatch(PLATFORM_KNOWLEDGE, /\$/);
  assert.doesNotMatch(PLATFORM_KNOWLEDGE, /\b(USD|EUR|GBP)\b/);
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
    assert.throws(() => ai.parseAssistantAnswer(content), /Zybble 2\.0 is unavailable/);
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
/* -------------------------------------------------------------------------- */
/* Streaming and the plain-text wire format                                    */
/* -------------------------------------------------------------------------- */

test("a plain-text reply keeps its prose and strips the SLUGS trailer", () => {
  const answer = ai.parsePlainAnswer(
    "The n8n course is the best fit for automation work.\nSLUGS: n8n-workflows, chatgpt-basics"
  );
  assert.equal(answer.text, "The n8n course is the best fit for automation work.");
  assert.deepEqual(answer.recommendedSlugs, ["n8n-workflows", "chatgpt-basics"]);
});

test("a trailer is never shown to the visitor, even without a newline", () => {
  const answer = ai.parsePlainAnswer("Nothing published yet.\nSLUGS: ");
  assert.equal(answer.text, "Nothing published yet.");
  assert.deepEqual(answer.recommendedSlugs, []);
});

test("an allow-listed LINK line becomes a link, an unknown one is dropped", () => {
  const ok = ai.parsePlainAnswer("Ask support about that.\nLINK: /help | Help Center");
  assert.deepEqual(ok.link, { href: "/help", label: "Help Center" });

  const blocked = ai.parsePlainAnswer("Ask support about that.\nLINK: /admin/users | Users");
  assert.equal(blocked.link, undefined);
  assert.equal(blocked.text, "Ask support about that.");
});

test("parseAssistantContent accepts both wire formats", () => {
  const json = ai.parseAssistantContent(
    JSON.stringify({ text: "Here you go", recommended_slugs: ["n8n-workflows"] })
  );
  assert.equal(json.text, "Here you go");
  assert.deepEqual(json.recommendedSlugs, ["n8n-workflows"]);

  const plain = ai.parseAssistantContent("Here you go\nSLUGS: n8n-workflows");
  assert.equal(plain.text, "Here you go");
  assert.deepEqual(plain.recommendedSlugs, ["n8n-workflows"]);
});

test("a content-free plain reply fails closed rather than rendering nothing", () => {
  assert.throws(() => ai.parseAssistantContent("   "), /Zybble 2\.0 is unavailable/);
  assert.throws(() => ai.parsePlainAnswer("SLUGS: n8n-workflows"), /Zybble 2\.0 is unavailable/);
});

test("the streaming filter withholds a trailer that has not finished arriving", () => {
  assert.equal(ai.visiblePrefix("Try n8n"), "Try n8n");
  // The blank line before a trailer is withheld with it, so nothing is left behind.
  assert.equal(ai.visiblePrefix("Try n8n\nSLUGS"), "Try n8n");
  assert.equal(ai.visiblePrefix("Try n8n\nSLUGS: n8n"), "Try n8n");
  // Once the line turns out to be prose it is released in full.
  assert.equal(ai.visiblePrefix("Try n8n\nSLUGS are fun"), "Try n8n\nSLUGS are fun");
  assert.equal(ai.visiblePrefix(""), "");
});

test("an SSE stream is read as deltas, then closed with a validated answer", async () => {
  const frames = [
    'data: {"choices":[{"delta":{"content":"Try "}}]}',
    'data: {"choices":[{"delta":{"content":"the n8n course."}}]}',
    'data: {"choices":[{"delta":{"content":"\\nSLUGS: n8n-workflows"}}]}',
    "data: [DONE]",
  ];
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      // Deliberately split a frame across chunks: the reader must reassemble it.
      controller.enqueue(encoder.encode(frames[0] + "\n\n" + frames[1].slice(0, 10)));
      controller.enqueue(encoder.encode(frames[1].slice(10) + "\n\n" + frames[2] + "\n\n" + frames[3] + "\n\n"));
      controller.close();
    },
  });

  const events = [];
  for await (const event of ai.streamZybbleAi({
    messages: [{ role: "user", content: "automation?" }],
    catalog,
    fetchImpl: async () => ({ ok: true, status: 200, body }),
  })) {
    events.push(event);
  }

  const text = events.filter((e) => e.type === "delta").map((e) => e.text).join("");
  assert.equal(text, "Try the n8n course.");
  assert.equal(events.at(-1).type, "done");
  assert.deepEqual(events.at(-1).answer.recommendedSlugs, ["n8n-workflows"]);
  // The trailer never reaches the visitor as text.
  assert.doesNotMatch(text, /SLUGS/);
});

test("a hallucinated slug in a streamed reply is still dropped before rendering", async () => {
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          'data: {"choices":[{"delta":{"content":"Sure.\\nSLUGS: totally-made-up-course"}}]}\n\ndata: [DONE]\n\n'
        )
      );
      controller.close();
    },
  });

  const events = [];
  for await (const event of ai.streamZybbleAi({
    messages: [{ role: "user", content: "anything?" }],
    catalog,
    fetchImpl: async () => ({ ok: true, status: 200, body }),
  })) {
    events.push(event);
  }

  assert.equal(events.at(-1).type, "done");
  assert.deepEqual(events.at(-1).answer.recommendedSlugs, ["totally-made-up-course"]);
  assert.deepEqual(
    ai.resolveRecommendations(events.at(-1).answer.recommendedSlugs, catalog),
    []
  );
});

test("a streamed reply is grounded in the prompt catalog, in INR", async () => {
  let sentBody = "";
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n'));
      controller.close();
    },
  });

  for await (const _event of ai.streamZybbleAi({
    messages: [{ role: "user", content: "hi" }],
    catalog,
    fetchImpl: async (_url, init) => {
      sentBody = String(init.body);
      return { ok: true, status: 200, body };
    },
  })) {
    void _event;
  }

  const payload = JSON.parse(sentBody);
  assert.equal(payload.stream, true);
  assert.equal(payload.model, "deepseek/deepseek-chat");
  // The model sees the catalog and nothing else — no KYC, no money internals.
  assert.match(payload.messages[0].content, /n8n-workflows/);
  assert.match(payload.messages[0].content, /price: 4000 INR/);
});

test("a rate-limited or failing upstream surfaces as the honest reason", async () => {
  for (const [status, reason] of [[429, "rate_limited"], [500, "unavailable"], [402, "rate_limited"]]) {
    await assert.rejects(
      (async () => {
        for await (const _event of ai.streamZybbleAi({
          messages: [{ role: "user", content: "hi" }],
          catalog,
          fetchImpl: async () => ({ ok: false, status, body: null }),
        })) {
          void _event;
        }
      })(),
      (error) => error.name === "AiUnavailableError" && error.reason === reason,
      `status ${status}`
    );
  }
});
