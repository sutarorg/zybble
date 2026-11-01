import { describe, expect, it } from "vitest";
import { readingTimeFor, type BlogPost } from "@/lib/blog";
import { normaliseSiteUrl, siteConfig } from "@/lib/site";

/**
 * The canonical-domain guard. Production once emitted `http://zybble.com`
 * into sitemap.xml and robots.txt because an environment variable was set
 * without the scheme; these tests pin the normalisation that prevents a
 * repeat, whatever the deployment environment contains.
 */
describe("normaliseSiteUrl", () => {
  it("uses the canonical production domain by default", () => {
    expect(normaliseSiteUrl(undefined)).toBe("https://zybble.com");
    expect(normaliseSiteUrl("")).toBe("https://zybble.com");
    expect(siteConfig.url).toMatch(/^https:\/\/zybble\.com$/);
  });

  it("upgrades an http:// production URL to https://", () => {
    // The exact misconfiguration observed in production.
    expect(normaliseSiteUrl("http://zybble.com")).toBe("https://zybble.com");
    expect(normaliseSiteUrl("http://zybble.com/")).toBe("https://zybble.com");
  });

  it("folds www into the canonical apex host", () => {
    expect(normaliseSiteUrl("https://www.zybble.com")).toBe("https://zybble.com");
    expect(normaliseSiteUrl("https://www.zybble.com/")).toBe("https://zybble.com");
  });

  it("strips trailing slashes and keeps a valid custom origin", () => {
    expect(normaliseSiteUrl("https://staging.example.com//")).toBe("https://staging.example.com");
    expect(normaliseSiteUrl(" https://preview.example.com ")).toBe("https://preview.example.com");
  });

  it("prepends https to a scheme-less value", () => {
    expect(normaliseSiteUrl("zybble.com")).toBe("https://zybble.com");
  });

  it("never upgrades local development origins to https", () => {
    // Forcing https on localhost pins browsers to https://localhost for years.
    expect(normaliseSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normaliseSiteUrl("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });

  it("falls back to the canonical domain on garbage input", () => {
    expect(normaliseSiteUrl("not a url")).toBe("https://zybble.com");
  });
});

describe("readingTimeFor", () => {
  const post = (blocks: BlogPost["blocks"]): BlogPost =>
    ({
      slug: "test",
      title: "Test",
      description: "",
      publishedAt: "2026-01-01",
      category: "Analytics",
      cover: { src: "/x.jpg", alt: "" },
      blocks,
    }) as BlogPost;

  it("estimates from actual body text, not a hand-written label", () => {
    // 630 words of paragraph text -> 3 minutes at 210 wpm.
    const paragraph = Array(630).fill("word").join(" ");
    const minutes = readingTimeFor(post([{ type: "paragraph", text: paragraph }]));
    expect(minutes).toMatch(/^\d+ min read$/);
    expect(Number.parseInt(minutes, 10)).toBe(3);
  });

  it("counts list items, FAQs and tables, not just prose", () => {
    // 5 copies of a 126-word string = 630 words -> 3 minutes.
    const text = Array(126).fill("word").join(" ");
    const result = readingTimeFor(
      post([
        { type: "paragraph", text },
        { type: "list", items: [text, text] },
        { type: "faq", items: [{ question: text, answer: text }] },
      ]),
    );
    expect(Number.parseInt(result, 10)).toBe(3);
  });

  it("never returns zero for a very short article", () => {
    expect(readingTimeFor(post([{ type: "paragraph", text: "Short." }]))).toBe("1 min read");
  });
});
