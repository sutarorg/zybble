/**
 * Catalog copy.
 *
 * Zybble translates *interface* chrome into six languages (see `./index.ts` in
 * the parent directory). It does not translate marketplace content: course
 * titles, descriptions and curriculum are rendered exactly as their creator
 * authored them, which is what learners and creators expect and what keeps
 * generated course copies honest.
 */

export interface TranslatableCourse {
  title: string;
  subtitle: string;
  description: string;
  longDescription: string[];
  whatYouLearn: string[];
}
