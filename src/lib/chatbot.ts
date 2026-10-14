import type { Course, CourseLevel } from "../types/index";

export interface ChatPreferences {
  category?: string;
  topic?: string[];
  level?: CourseLevel;
  maxPrice?: number;
  maxMinutes?: number;
}
export interface ChatReply {
  text: string;
  courses?: Course[];
  link?: { href: string; label: string };
  preferences: ChatPreferences;
}

const TOPICS: [RegExp, string, string[]][] = [
  [/\b(n8n|automat\w*|workflow\w*|zapier|make\.com)\b/i, "automation", ["n8n", "automation", "workflow"]],
  [/\b(python|data science|machine learning|analytics)\b/i, "data-science", ["python", "data", "machine learning"]],
  [/\b(cod\w*|develop\w*|program\w*|next\.?js|build.*apps?|ai apps?)\b/i, "development", ["apps", "development", "code"]],
  [/\b(chatgpt|prompt\w*|generative|llm\w*)\b/i, "generative-ai", ["chatgpt", "prompt", "generative"]],
  [/\b(video|image\w*|design|music|midjourney|creativ\w*)\b/i, "creation", ["video", "image", "creative"]],
  [/\b(market\w*|seo|social media|campaign\w*)\b/i, "marketing", ["marketing", "seo", "content"]],
  [/\b(business|startup\w*|entrepreneur\w*)\b/i, "business", ["business", "startup"]],
  [/\b(productivity|save time|notion|personal.*system)\b/i, "productivity", ["productivity", "notion"]],
];

/** Deliberately limited to public discovery pages, regardless of account role. */
export function isChatbotPage(pathname: string): boolean {
  return pathname === "/" || pathname === "/explore" || /^\/categories\/(automation|development|generative-ai|creation|marketing|data-science|business|productivity)\/?$/.test(pathname);
}

/** Offline catalog assistant. Never invents courses, accesses accounts or calls an AI service. */
export function answerChat(
  input: string,
  catalog: Course[],
  previous: ChatPreferences = {},
): ChatReply {
  const query = input.trim().toLowerCase();
  const preferences = { ...previous };
  const help = (text: string, href = "/help", label = "Visit Help Center"): ChatReply => ({ text, link: { href, label }, preferences });

  if (/\b(refund\w*|cancel\w*)\b/.test(query)) return help("Checkout here is a preview: no real payments are processed. For billing or refund questions, see the Help Center. I can’t cancel orders or issue refunds.");
  if (/\b(certificate\w*|certification)\b/.test(query)) return help("Complete every lesson in a course to earn a certificate. You can preview and download it from Certificates in your learner account. Certificates in this demo are illustrative, not publicly verified.");
  if (/\b(pay\w*|billing|checkout|credit card)\b/.test(query)) return help("Choose a course, open its course page, and select the enrollment button. Checkout is simulated in this preview — no real payment is taken. Never share card details in this chat.");
  if (/\b(enroll\w*|access|start learning|how.*courses.*work)\b/.test(query)) return help("Open a course page to review its curriculum, requirements, price and preview lessons. Sign in to enroll, then find your courses in My Learning. Courses are self-paced; this demo’s account and learning activity reset on refresh.");
  if (/\b(password|log.?in|sign.?in|account|sign.?up)\b/.test(query)) return help("Use Sign in or Sign up in the website header. Account data in this demo lasts for the current session and resets on refresh. I can guide you, but can’t access or change your account. Don’t share passwords here.", "/login", "Go to sign in");
  if (/\b(human|support|contact|help|problem|issue)\b/.test(query) && !/\b(course|find|choose|recommend)\b/.test(query)) return help("I can help you discover courses and explain enrollment, certificates and checkout. For anything I can’t answer, the Help Center has FAQs and a support option. What would you like help with?");
  if (/\b(language|caption\w*|subtitle\w*)\b/.test(query)) return help("Use the globe icon in the header to change the interface language. A course’s spoken language and available captions are listed on its course page.");
  if (/^(hi|hello|hey|thanks|thank you)[!. ]*$/.test(query)) return { text: "Happy to help! Tell me what you want to learn, your experience level, or your budget, and I’ll look through the catalog.", preferences };

  const reset = /\b(start over|reset|all courses|any category)\b/.test(query);
  if (reset) Object.keys(preferences).forEach((key) => delete preferences[key as keyof ChatPreferences]);
  const topic = TOPICS.find(([pattern]) => pattern.test(query));
  if (topic) {
    preferences.category = topic[1];
    preferences.topic = topic[2];
  }
  const level = /\b(beginner\w*|new to|no experience|getting started)\b/.test(query) ? "beginner"
    : /\b(intermediate)\b/.test(query) ? "intermediate"
    : /\b(advanced|expert)\b/.test(query) ? "advanced" : undefined;
  if (level) preferences.level = level;
  if (/\b(any level|all levels)\b/.test(query)) delete preferences.level;
  if (/\b(free)\b/.test(query)) preferences.maxPrice = 0;
  const budget = query.match(/(?:under|below|up to|budget(?: of)?|less than)\s*\$?\s*(\d+(?:\.\d+)?)(?![\d.]|\s*(?:hours?|hrs?|minutes?|mins?)\b)/);
  if (budget) preferences.maxPrice = Number(budget[1]);
  if (/\b(any price|no budget|paid)\b/.test(query)) delete preferences.maxPrice;
  const duration = query.match(/(?:under|below|up to|less than)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/);
  if (duration) preferences.maxMinutes = Number(duration[1]) * (/^(hour|hr)/.test(duration[2]) ? 60 : 1);
  if (/\b(any length|any duration)\b/.test(query)) delete preferences.maxMinutes;

  const named = catalog.filter((course) => course.tags.some((tag) => {
    const escaped = tag.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(query);
  }) || query.includes(course.title.toLowerCase()));
  const discovery = topic || level || budget || duration || reset || named.length || /\b(course\w*|recommend\w*|suggest\w*|learn|find|short|free|paid|cheapest|best|popular|any level|all levels|any price|any length|any duration)\b/.test(query);
  if (!discovery) return help("I’m a catalog guide, so I may not be able to answer that. Tell me a topic (like ChatGPT, automation or Python), your level, or a budget to find a course — or visit the Help Center for other questions.");

  // For an unrecognized subject, search the catalog rather than returning unrelated picks.
  const filler = new Set("i im i'm am a an the me my please want would like to can you do have any for on about in of and or course courses recommend recommended recommendations suggest find learn learning show some options more best popular cheapest cheap beginner beginners intermediate advanced free paid short shorter level levels price length duration all start over reset getting started no experience under below up budget less than dollars usd".split(" "));
  const searchTerms = !topic && !level && !budget && !duration && !reset && !named.length
    ? query.split(/[^a-z0-9]+/).filter((word) => word.length > 1 && !filler.has(word)) : [];
  const matches = catalog.filter((course) =>
    (!searchTerms.length || searchTerms.every((term) => `${course.title} ${course.subtitle} ${course.tags.join(" ")}`.toLowerCase().includes(term))) &&
    (!preferences.category || course.category === preferences.category) &&
    (!preferences.level || course.level === preferences.level) &&
    (preferences.maxPrice === undefined || course.price <= preferences.maxPrice) &&
    (preferences.maxMinutes === undefined || course.durationMinutes <= preferences.maxMinutes)
  );
  const score = (course: Course) => {
    const text = `${course.title} ${course.tags.join(" ")}`.toLowerCase();
    return (named.includes(course) ? 20 : 0) + (preferences.topic?.filter((t) => text.includes(t)).length ?? 0) * 3 + course.rating;
  };
  matches.sort((a, b) => /\b(cheapest|cheap)\b/.test(query) ? a.price - b.price : /\b(short\w*)\b/.test(query) ? a.durationMinutes - b.durationMinutes : score(b) - score(a) || b.studentsCount - a.studentsCount);
  if (!matches.length) return { text: "I couldn’t find a course matching those preferences. Try another topic, “any level” or “any price” to loosen a filter, or “start over” to reset. I won’t recommend a course that doesn’t match your filters.", preferences };
  const filters = [preferences.category?.replace(/-/g, " "), preferences.level, preferences.maxPrice === 0 ? "free" : preferences.maxPrice !== undefined ? `up to $${preferences.maxPrice}` : undefined, preferences.maxMinutes !== undefined ? `up to ${preferences.maxMinutes} minutes` : undefined].filter(Boolean);
  return {
    text: `Here are ${matches.length === 1 ? "a course" : "some courses"}${filters.length ? ` matching ${filters.join(" · ")}` : " to explore"}. Open a course for the full curriculum and requirements. You can narrow these down by topic, level, budget or duration.`,
    courses: matches.slice(0, 3),
    preferences,
  };
}
