/**
 * Canonical marketplace configuration.
 *
 * This module holds **product configuration only** — the eight marketplace
 * categories and the six interface languages. It contains no courses, no
 * instructors, no reviews, no orders and no financial figures. Everything that
 * represents a real business record lives in Supabase Postgres and is read at
 * request time.
 */

import type { Category } from "@/types";

/**
 * The marketplace category taxonomy.
 *
 * These rows are also seeded into `public.categories` by migration
 * `20260101000400_seed_configuration.sql`, so admins can edit them from the
 * portal and hide/rename/reorder them without a deploy. The constants below
 * remain the source of truth for slugs the UI links to.
 */
export const CATEGORIES: Category[] = [
  {
    slug: "automation",
    name: "Automation",
    shortName: "Automation",
    icon: "workflow",
    description: "Automate real workflows with agents, APIs and no-code tooling.",
  },
  {
    slug: "development",
    name: "Development",
    shortName: "Development",
    icon: "code-2",
    description: "Build, ship and deploy AI-powered applications end to end.",
  },
  {
    slug: "generative-ai",
    name: "Generative AI",
    shortName: "Generative AI",
    icon: "sparkles",
    description: "Master prompting and modern generative models.",
  },
  {
    slug: "creation",
    name: "Creation",
    shortName: "Creation",
    icon: "palette",
    description: "Create video, audio, music and visuals with AI tools.",
  },
  {
    slug: "marketing",
    name: "Marketing",
    shortName: "Marketing",
    icon: "megaphone",
    description: "Grow faster with AI-driven campaigns, funnels and content.",
  },
  {
    slug: "data-science",
    name: "Data Science",
    shortName: "Data Science",
    icon: "bar-chart-3",
    description: "Analyze data and build machine-learning models in Python.",
  },
  {
    slug: "business",
    name: "Business",
    shortName: "Business",
    icon: "briefcase",
    description: "Launch AI products and build companies around them.",
  },
  {
    slug: "productivity",
    name: "Productivity",
    shortName: "Productivity",
    icon: "timer",
    description: "Design personal AI systems that save hours every week.",
  },
];

export const CATEGORY_SLUGS = CATEGORIES.map((category) => category.slug);

export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function isCategorySlug(value: string): value is (typeof CATEGORY_SLUGS)[number] {
  return (CATEGORY_SLUGS as string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Interface languages                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Interface language is **not** payment currency. All six locales display every
 * monetary amount in INR (₹) using Indian number grouping.
 */
export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "ja", label: "Japanese", native: "日本語" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

/**
 * Languages a course can be *taught in*.
 *
 * This is course metadata, not interface chrome: the six interface languages
 * above translate Zybble's UI, while this list labels the language the creator
 * actually recorded their lessons in.
 */
export const TEACHING_LANGUAGES = [
  "English",
  "हिन्दी",
  "বাংলা",
  "मराठी",
  "తెలుగు",
  "தமிழ்",
  "ગુજરાતી",
  "ಕನ್ನಡ",
  "മലയാളം",
  "ਪੰਜਾਬੀ",
  "Assamese",
  "Odia",
  "Urdu",
] as const;
