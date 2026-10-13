import { COURSES } from "@/data/mock-data";
import { courseText } from "./courses";
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

/** Exact, offline translations: never changes account names or authored input. */
export function translateText(text: string, language: string): string {
  if (language === "en") return text;
  const source = text.trim().replace(/\s+/g, " ");
  const key = sourceKeys.get(source) ?? aliases[source];
  const value = key ? getDictionary(language)[key] : EXTRA_TEXT[source]?.[language];
  if (typeof value === "string") return text.replace(text.trim(), value);
  for (const course of COURSES) {
    const localized = courseText(course.id, language);
    if (!localized) continue;
    if (source === course.title) return localized.title;
    if (source === course.subtitle || source === course.description) return localized.subtitle;
    const learnIndex = course.whatYouLearn.indexOf(source);
    if (learnIndex >= 0 && localized.learn[learnIndex]) return localized.learn[learnIndex];
    const aboutIndex = course.longDescription.indexOf(source);
    if (aboutIndex >= 0 && localized.about[aboutIndex]) return localized.about[aboutIndex];
  }
  return text;
}
