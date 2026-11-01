/**
 * The free LinkedIn tools hub.
 *
 * Single source of truth for the four genuinely functional, no-signup tools:
 * their routes, metadata, keywords and cross-links. The hub page, the footer,
 * the sitemap and the tool pages themselves all read from here, so adding a
 * tool means adding one object.
 */

export interface FreeTool {
  /** URL path relative to the site root. */
  href: string;
  /** Short product-style name. */
  name: string;
  /** Tool page <title>. */
  title: string;
  /** Tool page meta description. */
  description: string;
  /** One-line card summary. */
  blurb: string;
  /** What the visitor can do with it — honest, capability-scoped bullets. */
  features: string[];
  /** Icon name from lucide-react (mapped in the UI layer). */
  icon: "calculator" | "calendar" | "type" | "search";
  /** The searcher problem this page solves. */
  keywords: string[];
  /** Visual accent for the card. */
  accent: string;
}

export const FREE_TOOLS: FreeTool[] = [
  {
    href: "/tools/linkedin-engagement-rate-calculator",
    name: "Engagement Rate Calculator",
    title: "LinkedIn Engagement Rate Calculator — free, no signup",
    description:
      "Calculate your LinkedIn engagement rate for free. Choose your denominator (impressions or reach), see the full calculation broken down, and learn how to read the result.",
    blurb:
      "Turn raw post numbers into an engagement rate you can actually compare — with the formula shown, not hidden.",
    features: [
      "Impressions, reactions, comments and reposts inputs",
      "Choose your denominator: impressions, reach or followers",
      "Full calculation breakdown, step by step",
      "Honest interpretation — no fake benchmarks",
    ],
    icon: "calculator",
    keywords: [
      "linkedin engagement rate calculator",
      "linkedin engagement rate formula",
      "calculate linkedin engagement",
    ],
    accent: "brand",
  },
  {
    href: "/resources/linkedin-content-calendar-template",
    name: "Content Calendar Template",
    title: "Free LinkedIn Content Calendar Template — planner + CSV",
    description:
      "Plan a week or month of LinkedIn posts in minutes. Interactive weekly and monthly planner plus a free downloadable CSV template with date, topic, format and status fields.",
    blurb:
      "Plan your week or month on an interactive planner, then download the CSV template for your own workflow.",
    features: [
      "Interactive weekly and monthly planner",
      "Downloadable CSV template — no email gate",
      "Date, topic, format, status and notes fields",
      "Practical planning instructions included",
    ],
    icon: "calendar",
    keywords: [
      "linkedin content calendar template",
      "free linkedin content calendar",
      "linkedin posting planner",
    ],
    accent: "sky",
  },
  {
    href: "/tools/linkedin-character-counter",
    name: "Character Counter",
    title: "LinkedIn Character Counter — live count with post limits",
    description:
      "Write LinkedIn posts with a live character and word counter. See LinkedIn's 3,000-character post limit, headline and comment limits at a glance, and copy your post when it is ready.",
    blurb:
      "Write with a live count against LinkedIn's real limits — posts, headlines, comments and more.",
    features: [
      "Live character and word count as you type",
      "LinkedIn's post, headline, comment and article limits",
      "One-click copy and clear",
      "Clean, mobile-friendly writing surface",
    ],
    icon: "type",
    keywords: [
      "linkedin character counter",
      "linkedin post character limit",
      "linkedin 3000 character limit",
    ],
    accent: "indigo",
  },
  {
    href: "/tools/linkedin-keyword-analyzer",
    name: "Keyword Analyzer",
    title: "LinkedIn Keyword Analyzer — free post analysis, no signup",
    description:
      "Analyse your LinkedIn post for keyword frequency, density and placement. Spot overused words, missing keywords and get concrete optimisation suggestions — computed in your browser, with no invented search volumes.",
    blurb:
      "See which keywords your post actually emphasises, which are missing, and what to adjust — real text analysis, no fake search volumes.",
    features: [
      "Keyword frequency, density and placement analysis",
      "Overused and missing keyword detection",
      "Related phrase suggestions from your own text",
      "No fabricated search volume or difficulty numbers",
    ],
    icon: "search",
    keywords: [
      "linkedin keyword analyzer",
      "linkedin post keyword analysis",
      "linkedin seo keywords",
    ],
    accent: "cyan",
  },
];

export function getTool(href: string): FreeTool | undefined {
  return FREE_TOOLS.find((tool) => tool.href === href);
}
