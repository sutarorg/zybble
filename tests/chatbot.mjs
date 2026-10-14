import assert from "node:assert/strict";
import { test } from "node:test";
import { answerChat, isChatbotPage } from "../src/lib/chatbot.ts";

const catalog = [
  { id: "one", title: "ChatGPT Basics", slug: "chatgpt-basics", subtitle: "Learn prompting", category: "generative-ai", tags: ["chatgpt"], level: "beginner", price: 0, durationMinutes: 90, rating: 4.5, studentsCount: 100 },
  { id: "two", title: "n8n Workflows", slug: "n8n-workflows", subtitle: "Automate your work", category: "automation", tags: ["n8n"], level: "intermediate", price: 40, durationMinutes: 180, rating: 4.8, studentsCount: 200 },
  { id: "three", title: "Advanced ChatGPT", slug: "advanced-chatgpt", subtitle: "Prompt engineering", category: "generative-ai", tags: ["chatgpt"], level: "advanced", price: 80, durationMinutes: 300, rating: 4.9, studentsCount: 300 },
];

test("only public discovery routes are allowed", () => {
  for (const route of ["/", "/explore", "/categories/automation", "/categories/data-science/"]) assert.equal(isChatbotPage(route), true, route);
  for (const route of ["/dashboard", "/my-learning", "/learn/one", "/creator", "/creator/signup", "/creator/courses", "/admin/categories", "/checkout/one", "/login", "/help", "/courses/chatgpt-basics", "/categories/unknown", "/categories/automation/edit"]) assert.equal(isChatbotPage(route), false, route);
});

test("recommendations are real catalog entries, respect topic and level", () => {
  const reply = answerChat("Find a beginner ChatGPT course", catalog);
  assert.deepEqual(reply.courses, [catalog[0]]);
  assert.equal(reply.preferences.category, "generative-ai");
  assert.equal(reply.preferences.level, "beginner");
});

test("follow-ups retain filters; reset clears them", () => {
  const first = answerChat("ChatGPT", catalog);
  const second = answerChat("Any free courses?", catalog, first.preferences);
  assert.deepEqual(second.courses, [catalog[0]]);
  const help = answerChat("How do I enroll?", catalog, second.preferences);
  assert.deepEqual(help.preferences, second.preferences);
  assert.equal(help.link.href, "/help");
  const reset = answerChat("start over", catalog, second.preferences);
  assert.deepEqual(reset.preferences, {});
  assert.equal(reset.courses.length, 3);
});

test("budget and duration are distinct and constrain results", () => {
  const duration = answerChat("courses under 20 hours", catalog);
  assert.equal(duration.preferences.maxMinutes, 1200);
  assert.equal(duration.preferences.maxPrice, undefined);
  assert.equal(duration.courses.length, 3);
  assert.deepEqual(answerChat("courses under $50", catalog).courses.map((c) => c.id).sort(), ["one", "two"]);
  assert.deepEqual(answerChat("courses under 2 hours", catalog).courses, [catalog[0]]);
});

test("no results and unknown subjects do not invent recommendations", () => {
  assert.equal(answerChat("free advanced automation courses", catalog).courses, undefined);
  assert.equal(answerChat("find a cooking course", catalog).courses, undefined);
  assert.equal(answerChat("What is the weather?", catalog).link.href, "/help");
  assert.equal(answerChat("recommend courses", []).courses, undefined);
});

test("help answers disclose preview limitations and cannot modify accounts", () => {
  assert.match(answerChat("payment help", catalog).text, /simulated/);
  assert.match(answerChat("refund please", catalog).text, /can’t.*refunds/);
  assert.match(answerChat("certificate", catalog).text, /not publicly verified/);
  assert.equal(answerChat("forgot password", catalog).link.href, "/login");
});
