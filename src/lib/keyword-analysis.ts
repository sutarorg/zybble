/**
 * Keyword analysis for LinkedIn posts.
 *
 * Pure, dependency-free text analysis — everything here is computed from the
 * text the user pastes in. There is deliberately NO search volume, keyword
 * difficulty or LinkedIn search data in this module: none of that can be
 * known without data Zybble does not have, and inventing it would be exactly
 * the kind of fake statistic the product refuses to ship.
 *
 * What IS honest and computable locally:
 *  - how many times each target keyword appears, and where;
 *  - keyword density against the post's real word count;
 *  - which distinctive phrases the text itself emphasises (frequency analysis
 *    of non-stopword unigrams/bigrams);
 *  - concrete, rule-based suggestions derived from those findings.
 */

export interface KeywordReport {
  keyword: string;
  occurrences: number;
  /** occurrences ÷ totalWords × 100, rounded to 1dp. */
  density: number;
  /** Character offset of the first occurrence, or null if absent. */
  firstPosition: number | null;
  inHook: boolean;
  inClosing: boolean;
  status: "missing" | "ok" | "overused";
}

export interface PhraseHit {
  phrase: string;
  count: number;
}

export interface AnalysisResult {
  totalWords: number;
  totalChars: number;
  keywordReports: KeywordReport[];
  /** Distinctive unigrams the text emphasises (stopwords removed). */
  topWords: PhraseHit[];
  /** Distinctive bigrams the text emphasises. */
  topBigrams: PhraseHit[];
  /** Rule-based, actionable suggestions derived only from the findings above. */
  suggestions: string[];
  /** True when there is enough text to say anything meaningful. */
  analysable: boolean;
}

const HOOK_CHARS = 210; // roughly the first 2–3 lines visible before "see more"
const CLOSING_CHARS = 210;

/**
 * A pragmatic English stopword list. It exists only to keep filler words out
 * of the "distinctive phrases" lists; it never affects keyword matching,
 * which uses the user's own terms verbatim.
 */
const STOPWORDS = new Set(
  ("a about above after again against all am an and any are aren as at be because been before being below between " +
    "both but by can cannot could couldn did didn do does doesn doing don down during each few for from further had " +
    "hadn has hasn have haven having he her here hers herself him himself his how i if in into is isn it its itself " +
    "just let me more most mustn my myself no nor not of off on once only or other ought our ours ourselves out over " +
    "own same shan she should shouldn so some such than that the their theirs them themselves then there these they " +
    "this those through to too under until up very was wasn we were weren what when where which while who whom why " +
    "will with won would wouldn you your yours yourself yourselves it's don't i'm you're we're that's there's can't " +
    "didn't doesn't isn't wasn't won't shouldn't couldn't wouldn't haven't hasn't").split(/\s+/),
);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): string[] {
  return normalise(text).split(" ").filter(Boolean);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  const normalizedHaystack = ` ${haystack} `;
  const paddedNeedle = ` ${needle} `;
  while ((index = normalizedHaystack.indexOf(paddedNeedle, index)) !== -1) {
    count += 1;
    index += 1;
  }
  return count;
}

/** Count non-overlapping phrase occurrences where the phrase may span words. */
function countPhrase(haystackWords: string[], phrase: string): number {
  const needle = words(phrase);
  if (needle.length === 0) return 0;
  let count = 0;
  for (let i = 0; i <= haystackWords.length - needle.length; i += 1) {
    let match = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystackWords[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      count += 1;
      i += needle.length - 1;
    }
  }
  return count;
}

function charIndexForWordIndex(text: string, target: string): number | null {
  // Find the character offset of the first occurrence of `target` (a phrase)
  // inside the original text, case-insensitively.
  const lower = text.toLowerCase();
  const needle = target.toLowerCase();
  const idx = lower.indexOf(needle);
  return idx === -1 ? null : idx;
}

export function analysePost(postText: string, keywordText: string): AnalysisResult {
  const original = postText.trim();
  const lowerOriginal = original.toLowerCase();
  const postWords = words(original);
  const totalWords = postWords.length;

  const keywords = keywordText
    .split(/[,\n]/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0 && k.length <= 80)
    .slice(0, 12); // keep the analysis readable

  const hook = lowerOriginal.slice(0, HOOK_CHARS);
  const closing = lowerOriginal.slice(Math.max(0, lowerOriginal.length - CLOSING_CHARS));

  const keywordReports: KeywordReport[] = keywords.map((keyword) => {
    const occurrences = countPhrase(postWords, keyword);
    const density = totalWords > 0 ? (occurrences / totalWords) * 100 : 0;
    const keywordWords = keyword.split(/\s+/);
    // Placement check uses a reduced form so multi-word keywords match within
    // the hook/closing slices (e.g. "engagement rate" inside the first 210 chars).
    const probe = occurrences > 0 ? charIndexForWordIndex(original, keyword) : null;

    let status: KeywordReport["status"];
    if (occurrences === 0) status = "missing";
    else if (density > 3 || occurrences > 5 || keywordWords.length === 1 && occurrences > 6) status = "overused";
    else status = "ok";

    return {
      keyword,
      occurrences,
      density: Math.round(density * 10) / 10,
      firstPosition: probe,
      inHook: occurrences > 0 && hook.includes(keyword),
      inClosing: occurrences > 0 && closing.includes(keyword),
      status,
    };
  });

  // Distinctive phrases: frequency analysis of the text's own words/bigrams.
  const wordCounts = new Map<string, number>();
  for (const w of postWords) {
    if (w.length < 4 || STOPWORDS.has(w)) continue;
    wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
  }
  const bigramCounts = new Map<string, number>();
  for (let i = 0; i < postWords.length - 1; i += 1) {
    const a = postWords[i];
    const b = postWords[i + 1];
    if (STOPWORDS.has(a) || STOPWORDS.has(b) || a.length < 4 || b.length < 4) continue;
    const key = `${a} ${b}`;
    bigramCounts.set(key, (bigramCounts.get(key) ?? 0) + 1);
  }

  const toHits = (map: Map<string, number>, limit: number): PhraseHit[] =>
    [...map.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([phrase, count]) => ({ phrase, count }));

  const topWords = toHits(wordCounts, 8);
  const topBigrams = toHits(bigramCounts, 6);

  // Suggestions — each derived from an actual finding above.
  const suggestions: string[] = [];
  const missing = keywordReports.filter((r) => r.status === "missing");
  const overused = keywordReports.filter((r) => r.status === "overused");
  const presentNotInHook = keywordReports.filter((r) => r.status === "ok" && !r.inHook);
  const presentInHook = keywordReports.filter((r) => r.inHook);

  if (totalWords > 0 && totalWords < 60) {
    suggestions.push(
      `This draft is ${totalWords} words. LinkedIn posts have room for more substance — most of the analysis below gets sharper above roughly 150 words.`,
    );
  }
  if (missing.length > 0) {
    suggestions.push(
      `${missing.map((r) => `"${r.keyword}"`).join(", ")} ${missing.length === 1 ? "never appears in the post. Either work it in naturally" : "never appear in the post. Work them in naturally"} — ideally in the first two lines, where scanning readers decide to continue.`,
    );
  }
  for (const report of presentNotInHook.slice(0, 2)) {
    suggestions.push(
      `"${report.keyword}" appears ${report.occurrences} ${report.occurrences === 1 ? "time" : "times"} but not in the first ${HOOK_CHARS} characters. Moving one mention into the hook makes the topic visible before "see more" cuts the post off.`,
    );
  }
  for (const report of overused) {
    suggestions.push(
      `"${report.keyword}" appears ${report.occurrences} times (${report.density}% of all words). That density reads as keyword stuffing to people as well as algorithms — replace one or two mentions with a related phrase${topBigrams.length ? ` such as "${topBigrams[0].phrase}"` : ""}.`,
    );
  }
  if (presentInHook.length > 1) {
    suggestions.push(
      `Your first two lines carry ${presentInHook.length} target keywords. That risks reading as a keyword list rather than a hook — keep the strongest and rewrite the opening around one idea.`,
    );
  }
  if (topBigrams.length > 0 && keywordReports.length > 0) {
    suggestions.push(
      `The post emphasises ${topBigrams
        .slice(0, 3)
        .map((p) => `"${p.phrase}"`)
        .join(", ")} — if any of these matter for how you want to be found, consider adding them to your tracked keywords for this post.`,
    );
  }
  if (original.length > 0 && keywordReports.every((r) => !r.inClosing) && totalWords >= 60) {
    suggestions.push(
      "No target keyword appears in the final lines. Closing where your reader's eye rests — the CTA or takeaway — is one more chance to reinforce the topic without stuffing.",
    );
  }
  if (suggestions.length === 0 && keywordReports.length > 0) {
    suggestions.push(
      "No issues found in this pass: every tracked keyword appears with sensible density, and the emphasis phrases match your targets. The remaining lever is the quality of the hook itself — which is a writing question, not a keyword one.",
    );
  }
  if (keywordReports.length === 0 && totalWords > 0) {
    suggestions.push("Add one to three target keywords above to get placement and density analysis for this text.");
  }

  return {
    totalWords,
    totalChars: original.length,
    keywordReports,
    topWords,
    topBigrams,
    suggestions,
    analysable: totalWords >= 20,
  };
}
