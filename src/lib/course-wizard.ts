/**
 * Course creation wizard — pure domain logic.
 *
 * Everything in this module is derived from real, already-saved records (or
 * from plain form input about to be validated by the server). It holds no data
 * of its own: the wizard's steps, completion state and readiness checklist are
 * computed here so the UI checklist and the server-side submission rules can
 * never drift apart again.
 */

import { z } from "zod";
import { inrPriceInputSchema } from "@/lib/money";

/* -------------------------------------------------------------------------- */
/* Wizard steps                                                                */
/* -------------------------------------------------------------------------- */

export const COURSE_WIZARD_STEP_IDS = ["details", "curriculum", "resources", "review"] as const;
export type CourseWizardStepId = (typeof COURSE_WIZARD_STEP_IDS)[number];

export interface CourseWizardStepMeta {
  id: CourseWizardStepId;
  title: string;
  description: string;
}

export const COURSE_WIZARD_STEP_META: readonly CourseWizardStepMeta[] = [
  {
    id: "details",
    title: "Details & pricing",
    description: "Title, category, level, language, outcomes and pricing.",
  },
  {
    id: "curriculum",
    title: "Curriculum",
    description: "Organise sections and lessons, upload videos and set free previews.",
  },
  {
    id: "resources",
    title: "Thumbnail & resources",
    description: "Add the course thumbnail and any downloadable files.",
  },
  {
    id: "review",
    title: "Review & submit",
    description: "Check readiness and request administrator review.",
  },
] as const;

export interface CourseWizardStep extends CourseWizardStepMeta {
  /** `null` only before the course record exists (step 1 of `/creator/courses/new`). */
  href: string | null;
  /** True when the step reflects real, saved server state. */
  done: boolean;
  /** Locked steps cannot be opened yet — the course record does not exist. */
  locked: boolean;
  /** Why the step is locked, for the stepper to announce. */
  lockedReason?: string;
}

/** The state a wizard step is derived from. All fields come from saved rows. */
export interface CourseWizardState {
  /** `null` on the create page before the first save. */
  courseId: string | null;
  title: string;
  description: string;
  categorySlug: string | null;
  thumbnailKey: string | null;
  /** Saved lesson rows — the same aggregate the course card shows. */
  lessonsCount: number;
  status: string;
}

/** Title + description, the first submission requirement. */
export function detailsComplete(title: string, description: string): boolean {
  return title.trim().length >= 3 && description.trim().length > 0;
}

/** A category must be chosen before submission. */
export function categoryComplete(categorySlug: string | null | undefined): boolean {
  return Boolean(categorySlug && categorySlug.trim());
}

/**
 * Builds the four wizard steps from real course state.
 *
 * Later steps unlock as soon as the course record exists — a creator can jump
 * between them freely, and `done` only ever reflects what is actually saved.
 */
export function buildCourseWizardSteps(state: CourseWizardState): CourseWizardStep[] {
  const courseId = state.courseId;

  return COURSE_WIZARD_STEP_META.map((meta, index) => {
    const locked = index > 0 && courseId === null;
    const href = courseId
      ? {
          details: `/creator/courses/${courseId}/edit`,
          curriculum: `/creator/courses/${courseId}/curriculum`,
          resources: `/creator/courses/${courseId}/content`,
          review: `/creator/courses/${courseId}/publish`,
        }[meta.id]
      : meta.id === "details"
        ? "/creator/courses/new"
        : null;

    let done: boolean;
    switch (meta.id) {
      case "details":
        done = detailsComplete(state.title, state.description) && categoryComplete(state.categorySlug);
        break;
      case "curriculum":
        done = state.lessonsCount > 0;
        break;
      case "resources":
        done = Boolean(state.thumbnailKey);
        break;
      case "review":
        // The step's job is to submit. It is done while a review is open or
        // concluded — a `changes_requested` / `rejected` course needs another
        // submission, so it is not done.
        done = ["pending", "published", "unpublished"].includes(state.status);
        break;
    }

    return {
      ...meta,
      href,
      done,
      locked,
      lockedReason: locked ? "Save the course details first to unlock this step." : undefined,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Submission readiness                                                        */
/* -------------------------------------------------------------------------- */

export interface CourseReadinessLesson {
  kind: string;
  playbackReady: boolean;
  hasVideo: boolean;
}

export interface CourseReadinessInput {
  courseId: string | null;
  title: string;
  description: string;
  categorySlug: string | null;
  thumbnailKey: string | null;
  pricePaise: number;
  lessons: CourseReadinessLesson[];
}

export type CourseReadinessCheckId =
  | "details"
  | "category"
  | "lessons"
  | "lessonContent"
  | "thumbnail"
  | "pricing";

export interface CourseReadinessCheck {
  id: CourseReadinessCheckId;
  label: string;
  detail: string;
  done: boolean;
  /** Wizard step a creator can open to fix a missing requirement. */
  fixStep: CourseWizardStepId | null;
}

export interface CourseReadiness {
  checks: CourseReadinessCheck[];
  /** True when every check is satisfied — the same rule the server enforces. */
  ready: boolean;
  /** Labels of the checks that are not satisfied yet. */
  missing: string[];
}

/**
 * The readiness requirements for submitting a course for review.
 *
 * This is the single source of truth: the review page renders these checks and
 * `submitCourseForReview` refuses to submit until the same checks pass, so the
 * checklist can never promise something the server will not honour.
 */
export function computeCourseReadiness(input: CourseReadinessInput): CourseReadiness {
  const lessons = input.lessons;

  const checks: CourseReadinessCheck[] = [
    {
      id: "details",
      label: "Title and description",
      detail: "A title of at least 3 characters and a description are required.",
      done: detailsComplete(input.title, input.description),
      fixStep: "details",
    },
    {
      id: "category",
      label: "Category selected",
      detail: "Learners find courses through categories.",
      done: categoryComplete(input.categorySlug),
      fixStep: "details",
    },
    {
      id: "lessons",
      label: "At least one lesson",
      detail: "A course with no lessons cannot be reviewed.",
      done: lessons.length > 0,
      fixStep: "curriculum",
    },
    {
      id: "lessonContent",
      label: "Every lesson is ready",
      detail:
        "Video lessons must have a video and finish encoding on Bunny Stream before learners can watch them. Reading and quiz lessons are ready as soon as they exist.",
      done:
        lessons.length > 0 &&
        lessons.every((lesson) => (lesson.kind === "video" ? lesson.playbackReady : true)),
      fixStep: "curriculum",
    },
    {
      id: "thumbnail",
      label: "Thumbnail uploaded",
      detail: "Courses without a thumbnail look unfinished in the catalog.",
      done: Boolean(input.thumbnailKey),
      fixStep: "resources",
    },
    {
      id: "pricing",
      label: input.pricePaise > 0 ? "Paid course pricing (INR)" : "Pricing (Free)",
      detail:
        input.pricePaise > 0
          ? `Priced at integer paise (${input.pricePaise}). Learners pay in INR through Razorpay Checkout.`
          : "This course is free — learners enrol without payment.",
      done: true,
      fixStep: "details",
    },
  ];

  return {
    checks,
    ready: checks.every((check) => check.done),
    missing: checks.filter((check) => !check.done).map((check) => check.label),
  };
}

/* -------------------------------------------------------------------------- */
/* Server-validated input schemas                                              */
/* -------------------------------------------------------------------------- */

/**
 * Course details payload accepted by `saveCourse`.
 *
 * Price is typed in rupees and converted to integer paise with exact decimal
 * arithmetic. Zero-priced courses stay free.
 */
export const courseSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3, "Add a course title").max(140),
  subtitle: z.string().trim().max(180).optional(),
  description: z.string().trim().max(6000).optional(),
  categorySlug: z.string().trim().min(2, "Choose a category").max(60),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  language: z.string().trim().min(2).max(40),
  /** Typed in rupees; converted to integer paise with exact decimal arithmetic. */
  priceRupees: z.union([z.string(), z.number()]).default("0"),
  compareAtRupees: z.union([z.string(), z.number()]).optional(),
  whatYouLearn: z.array(z.string().max(400)).max(20).default([]),
  requirements: z.array(z.string().max(400)).max(20).default([]),
  audience: z.array(z.string().max(400)).max(20).default([]),
});

export const sectionSchema = z.object({
  courseId: z.string().uuid(),
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Section title is required").max(120),
  sortOrder: z.number().int().min(0).max(999),
});

export const lessonSchema = z.object({
  courseId: z.string().uuid(),
  id: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "Lesson title is required").max(160),
  description: z.string().trim().max(2000).optional(),
  kind: z.enum(["video", "reading", "quiz"]).default("video"),
  sortOrder: z.number().int().min(0).max(9999),
  durationMinutes: z.number().int().min(0).max(600).default(0),
  isPreview: z.boolean().default(false),
});

export type CourseDetailsInput = z.infer<typeof courseSchema>;
export type SectionInput = z.infer<typeof sectionSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;

export { inrPriceInputSchema };
