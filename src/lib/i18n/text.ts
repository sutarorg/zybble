import { en, type Dictionary } from "./en";
import { getDictionary } from "./index";
import { EXTRA_TEXT } from "./extra";

const sourceKeys = new Map<string, keyof Dictionary>();
for (const [key, value] of Object.entries(en)) {
  if (typeof value === "string") sourceKeys.set(value, key as keyof Dictionary);
}
const aliases: Record<string, keyof Dictionary> = {
  "All prices": "anyPrice", "All levels": "anyLevel", "Any length": "anyDuration",
  "8+ hours": "longLabel", "Features": "resourcesLabel", "Creator studio": "creatorStudio",
  "My courses": "myCourses", "Revenue trend": "revenueOverTime", "Creator tip": "tipTitle",
  "Learner reviews": "reviewsTitle", "Courses": "instructorCourses", "Students": "instructorStudents",
  "Create. Teach. Earn.": "csEyebrow", "Create a free account": "createFreeAccount",
};

/**
 * Exact, offline translations for interface copy.
 *
 * Only static interface strings are translated. Course titles, descriptions and
 * lesson content are authored by creators and are rendered in the language they
 * were written in — Zybble does not machine-translate marketplace content.
 * Money is never translated: every locale renders INR (₹).
 */
export function translateText(text: string, language: string): string {
  if (language === "en") return text;
  const source = text.trim().replace(/\s+/g, " ");
  const key = sourceKeys.get(source) ?? aliases[source];
  const value = key ? getDictionary(language)[key] : EXTRA_TEXT[source]?.[language];
  if (typeof value === "string") return text.replace(text.trim(), value);
  return text;
}
