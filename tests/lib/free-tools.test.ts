import { describe, expect, it } from "vitest";
import { analysePost } from "@/lib/keyword-analysis";
import { renderContactEmail } from "@/features/notifications/contact";

/**
 * The free tools compute real results in the browser — these tests pin the
 * analysis logic so the tool cannot silently start returning nonsense.
 */

describe("analysePost", () => {
  const POST = [
    "Most founders treat LinkedIn analytics like a scoreboard. It isn't.",
    "Analytics is a decision tool for your next post, not a trophy cabinet.",
    "When a post outperforms your median, the useful question is what changed about who saw your work. Engagement rate tells the truth about what your audience needed.",
  ].join(" ");

  it("counts occurrences and density for present keywords", () => {
    const result = analysePost(POST, "engagement rate");
    const report = result.keywordReports.find((r) => r.keyword === "engagement rate");
    expect(report).toBeDefined();
    expect(report!.occurrences).toBe(1);
    expect(report!.status).toBe("ok");
    expect(result.totalWords).toBeGreaterThan(20);
  });

  it("flags missing keywords", () => {
    const result = analysePost(POST, "content calendar");
    expect(result.keywordReports[0].status).toBe("missing");
    expect(result.keywordReports[0].occurrences).toBe(0);
    expect(result.suggestions.some((s) => s.includes("content calendar"))).toBe(true);
  });

  it("flags overused keywords by density", () => {
    const text = Array.from({ length: 40 }, () => "analytics").join(" ");
    const result = analysePost(text, "analytics");
    expect(result.keywordReports[0].status).toBe("overused");
    expect(result.keywordReports[0].density).toBeGreaterThan(3);
    expect(result.suggestions.some((s) => s.includes("stuffing"))).toBe(true);
  });

  it("detects hook and closing placement", () => {
    const hookPost = "linkedin analytics is the topic. ".repeat(1) + Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ") + " closing with linkedin analytics.";
    const result = analysePost(hookPost, "linkedin analytics");
    const report = result.keywordReports[0];
    expect(report.inHook).toBe(true);
    expect(report.inClosing).toBe(true);
  });

  it("surfaces distinctive phrases from the text itself", () => {
    const text = `${"engagement rate ".repeat(4)}${"best time ".repeat(4)}filler words here to push the length beyond the minimum threshold for analysis purposes and so on.`;
    const result = analysePost(text, "");
    const phrases = result.topBigrams.map((p) => p.phrase);
    expect(phrases).toContain("engagement rate");
  });

  it("never invents search metrics — the result contains only text-derived fields", () => {
    const result = analysePost(POST, "analytics");
    const serialised = JSON.stringify(result);
    for (const banned of ["search volume", "difficulty", "cpc", "monthly searches"]) {
      expect(serialised.toLowerCase()).not.toContain(banned);
    }
  });

  it("is honest about short drafts", () => {
    const result = analysePost("Too short.", "analytics");
    expect(result.analysable).toBe(false);
  });

  it("caps keyword processing at 12 and handles empty input", () => {
    const many = Array.from({ length: 20 }, (_, i) => `keyword${i}`).join(", ");
    const result = analysePost(POST, many);
    expect(result.keywordReports.length).toBeLessThanOrEqual(12);
    expect(analysePost("", "").analysable).toBe(false);
  });
});

describe("renderContactEmail", () => {
  it("builds a subject, text and html body from the message", () => {
    const rendered = renderContactEmail({
      name: "Priya Sharma",
      email: "priya@example.com",
      topic: "support",
      message: "Scheduling failed on Tuesday.",
    });
    expect(rendered.subject).toContain("[Zybble contact]");
    expect(rendered.subject).toContain("Priya Sharma");
    expect(rendered.text).toContain("priya@example.com");
    expect(rendered.html).toContain("Scheduling failed on Tuesday.");
  });

  it("escapes HTML in user input so the email cannot be injected", () => {
    const rendered = renderContactEmail({
      name: "Evil <script>alert('x')</script>",
      email: "evil@example.com",
      topic: "other",
      message: "<img src=x onerror=alert(1)> hello",
    });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("<img src=x");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).toContain("&lt;img src=x");
  });

  it("labels known topics and falls back for unknown ones", () => {
    expect(renderContactEmail({ name: "A", email: "a@b.co", topic: "security", message: "x y z" }).subject).toContain("Security");
    expect(renderContactEmail({ name: "A", email: "a@b.co", topic: "mystery", message: "x y z" }).subject).toContain("General");
  });
});
