/**
 * Zybble interface language system.
 *
 * `Dictionary` describes every piece of *interface* copy in the app —
 * navigation, buttons, headings, forms, empty states and the marketing
 * surfaces (auth pages, creator signup). `en` is the source of truth: every
 * other locale is typed as `Dictionary`, so a missing key is a build error.
 *
 * Catalog copy lives next to it in `./courses.ts`: course titles, subtitles,
 * descriptions and learning outcomes are translated per course so the course
 * cards and the course detail page follow the selected interface language too.
 * Lesson-level curriculum stays in the language the course was authored in
 * (the same way a real marketplace treats course content).
 *
 * The active code is persisted by AppProviders (`zybble.language.v1`) and
 * mirrored onto `<html lang>` so assistive tech and the browser see it too.
 */

import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";
import { fr } from "./fr";
import { de } from "./de";
import { ja } from "./ja";
import { courseText, type TranslatableCourse } from "./courses";

export type Dictionary = typeof en;

export const DICTIONARIES: Record<string, Dictionary> = { en, es, pt, fr, de, ja };

export const LANGUAGE_CODES = ["en", "es", "pt", "fr", "de", "ja"] as const;

/** BCP-47 tag used for number/date formatting. */
export const LOCALES: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
};

/** Dictionary for a stored language code; falls back to English. */
export function getDictionary(code: string | null | undefined): Dictionary {
  return (code && DICTIONARIES[code]) || en;
}

export function localeOf(code: string | null | undefined): string {
  return (code && LOCALES[code]) || "en-US";
}

export type { TranslatableCourse };

/**
 * Return a shallow copy of a course with its catalog copy swapped into the
 * active language. Courses without a translation (for example courses created
 * locally in the creator studio) fall back to their authored text.
 */
export function translateCourse<T extends TranslatableCourse>(course: T, language: string): T {
  if (!language || language === "en") return course;
  const text = courseText(course.id, language);
  if (!text) return course;
  return {
    ...course,
    title: text.title || course.title,
    subtitle: text.subtitle || course.subtitle,
    description: text.subtitle || course.description,
    longDescription: text.about?.length ? text.about : course.longDescription,
    whatYouLearn: text.learn?.length ? text.learn : course.whatYouLearn,
  };
}
