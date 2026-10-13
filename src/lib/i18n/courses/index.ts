/**
 * Catalog translations.
 *
 * Course *cards* follow the interface language: title, subtitle, description,
 * learning outcomes and the long description are translated here per course id.
 * Lesson-level curriculum and learner reviews stay in the language they were
 * written in — the same way a real marketplace treats course content.
 *
 * Courses without an entry (for example a course created locally in the
 * creator studio) simply keep their authored copy.
 */

import { es } from "./es";
import { pt } from "./pt";
import { fr } from "./fr";
import { de } from "./de";
import { ja } from "./ja";

export interface TranslatableCourse {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  longDescription: string[];
  whatYouLearn: string[];
}

export interface CourseText {
  title: string;
  subtitle: string;
  learn: string[];
  about: string[];
}

export type CourseTextMap = Record<string, CourseText>;

export const COURSE_TEXT: Record<string, CourseTextMap> = { es, pt, fr, de, ja };

export function courseText(id: string, language: string): CourseText | undefined {
  return COURSE_TEXT[language]?.[id];
}
