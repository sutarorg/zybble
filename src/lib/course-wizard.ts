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
    title: "Details & thumbnail",
    description: "Title, category, level, language, outcomes and thumbnail.",
  },
  {
    id: "curriculum",
    title: "Curriculum",
    description: "Organise sections and lessons, upload videos and set free previews.",
  },
  {
    id: "resources",
    title: "Pricing",
    description: "Set the course price in INR or keep it free.",
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
        done = true;
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
      done: locked ? false : done,
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
  quizReady?: boolean;
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
        lessons.every((lesson) => {
          if (lesson.kind === "video") return lesson.playbackReady;
          if (lesson.kind === "quiz" && typeof lesson.quizReady === "boolean") return lesson.quizReady;
          return true;
        }),
      fixStep: "curriculum",
    },
    {
      id: "thumbnail",
      label: "Thumbnail uploaded",
      detail: "Courses without a thumbnail look unfinished in the catalog.",
      done: Boolean(input.thumbnailKey),
      fixStep: "details",
    },
    {
      id: "pricing",
      label: input.pricePaise > 0 ? "Paid course pricing (INR)" : "Pricing (Free)",
      detail:
        input.pricePaise > 0
          ? `Priced at integer paise (${input.pricePaise}). Learners pay in INR through Razorpay Checkout.`
          : "This course is free — learners enrol without payment.",
      done: true,
      fixStep: "resources",
    },
  ];

  return {
    checks,
    ready: checks.every((check) => check.done),
    missing: checks.filter((check) => !check.done).map((check) => check.label),
  };
}

/* -------------------------------------------------------------------------- */
/* Quiz & Lesson Resource Payload Schemas & Serialization                      */
/* -------------------------------------------------------------------------- */

export const QUIZ_QUESTION_TYPES = ["multiple-choice", "true-false"] as const;
export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation?: string;
  points?: number;
}

export interface QuizConfig {
  passingScorePercent: number;
  questions: QuizQuestion[];
}

export const quizOptionSchema = z.object({
  id: z.string().trim().min(1, "Option ID is required").max(80),
  text: z
    .string()
    .trim()
    .min(1, "Enter text for each answer option")
    .max(300, "Answer option must be 300 characters or fewer"),
});

export const quizQuestionSchema = z
  .object({
    id: z.string().trim().min(1, "Question ID is required").max(80),
    type: z.enum(QUIZ_QUESTION_TYPES).default("multiple-choice"),
    question: z
      .string()
      .trim()
      .min(1, "Enter a question prompt")
      .max(500, "Question prompt must be 500 characters or fewer"),
    options: z
      .array(quizOptionSchema)
      .min(2, "Each question requires at least 2 answer options")
      .max(6, "Each question can have at most 6 answer options"),
    correctOptionId: z.string().trim().min(1, "Select the correct answer"),
    explanation: z
      .string()
      .trim()
      .max(600, "Explanation must be 600 characters or fewer")
      .optional()
      .default(""),
    points: z.coerce.number().int().min(1).max(100).optional().default(1),
  })
  .refine(
    (q) => q.options.some((opt) => opt.id === q.correctOptionId && opt.text.trim().length > 0),
    {
      path: ["correctOptionId"],
      message: "Select one of the answer options as the correct answer",
    }
  );

export const quizConfigSchema = z.object({
  passingScorePercent: z.coerce.number().int().min(0).max(100).default(70),
  questions: z
    .array(quizQuestionSchema)
    .min(1, "Add at least one question before saving the quiz")
    .max(50, "A quiz can have at most 50 questions"),
});

export interface LessonResourceLink {
  id: string;
  title: string;
  url: string;
  description?: string;
}

export const lessonResourceLinkSchema = z.object({
  id: z.string().trim().min(1, "Link ID is required").max(80),
  title: z
    .string()
    .trim()
    .min(1, "Enter a resource title")
    .max(160, "Resource title must be 160 characters or fewer"),
  url: z
    .string()
    .trim()
    .url("Enter a valid URL starting with https:// or http://")
    .refine((value) => /^https?:\/\//i.test(value), "URL must start with https:// or http://"),
  description: z
    .string()
    .trim()
    .max(400, "Resource description must be 400 characters or fewer")
    .optional()
    .default(""),
});

const QUIZ_MARKER_PREFIX = "<!--zybble-quiz:";
const RESOURCES_MARKER_PREFIX = "<!--zybble-resources:";
const MARKER_SUFFIX = "-->";

/**
 * Strips any embedded quiz or resource metadata comment from a lesson
 * description so plain-text views only render the human-readable instructions.
 */
export function getCleanLessonDescription(rawDescription: string | null | undefined): string {
  if (!rawDescription) return "";
  let text = rawDescription;
  for (const prefix of [QUIZ_MARKER_PREFIX, RESOURCES_MARKER_PREFIX]) {
    const idx = text.indexOf(prefix);
    if (idx !== -1) {
      text = text.slice(0, idx);
    }
  }
  return text.trim();
}

/**
 * Serializes human-readable quiz instructions alongside structured quiz
 * questions and settings into the lesson `description` column.
 */
export function serializeLessonQuiz(input: {
  instructions?: string;
  passingScorePercent?: number;
  questions: QuizQuestion[];
}): string {
  const cleanInstructions = getCleanLessonDescription(input.instructions ?? "").slice(0, 2000);
  const payload: QuizConfig = {
    passingScorePercent: Math.max(0, Math.min(100, Math.round(input.passingScorePercent ?? 70))),
    questions: input.questions.map((q) => ({
      id: q.id.trim(),
      type: q.type ?? "multiple-choice",
      question: q.question.trim(),
      options: q.options.map((o) => ({ id: o.id.trim(), text: o.text.trim() })),
      correctOptionId: q.correctOptionId.trim(),
      explanation: (q.explanation ?? "").trim(),
      points: q.points ?? 1,
    })),
  };
  const encoded = `${QUIZ_MARKER_PREFIX}${JSON.stringify(payload)}${MARKER_SUFFIX}`;
  return cleanInstructions ? `${cleanInstructions}\n\n${encoded}` : encoded;
}

/**
 * Parses a lesson `description` into quiz instructions, passing score, and
 * validated questions. Gracefully handles legacy plain-text quiz descriptions.
 */
export function parseLessonQuiz(rawDescription: string | null | undefined): {
  instructions: string;
  passingScorePercent: number;
  questions: QuizQuestion[];
} {
  const instructions = getCleanLessonDescription(rawDescription);
  if (!rawDescription) {
    return { instructions: "", passingScorePercent: 70, questions: [] };
  }
  const startIdx = rawDescription.indexOf(QUIZ_MARKER_PREFIX);
  if (startIdx === -1) {
    return { instructions, passingScorePercent: 70, questions: [] };
  }
  const jsonStart = startIdx + QUIZ_MARKER_PREFIX.length;
  const endIdx = rawDescription.indexOf(MARKER_SUFFIX, jsonStart);
  const rawJson = endIdx !== -1 ? rawDescription.slice(jsonStart, endIdx) : rawDescription.slice(jsonStart);
  try {
    const parsed = JSON.parse(rawJson) as Partial<QuizConfig>;
    const passingScorePercent =
      typeof parsed.passingScorePercent === "number" && Number.isFinite(parsed.passingScorePercent)
        ? Math.max(0, Math.min(100, Math.round(parsed.passingScorePercent)))
        : 70;
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .map((q): QuizQuestion | null => {
            if (!q || typeof q !== "object") return null;
            const options = Array.isArray(q.options)
              ? q.options
                  .filter((o) => o && typeof o.id === "string" && typeof o.text === "string")
                  .map((o) => ({ id: o.id, text: o.text }))
              : [];
            if (!q.id || typeof q.question !== "string" || options.length < 2) return null;
            return {
              id: String(q.id),
              type: q.type === "true-false" ? "true-false" : "multiple-choice",
              question: q.question,
              options,
              correctOptionId:
                typeof q.correctOptionId === "string" && options.some((o) => o.id === q.correctOptionId)
                  ? q.correctOptionId
                  : options[0].id,
              explanation: typeof q.explanation === "string" ? q.explanation : "",
              points: typeof q.points === "number" ? q.points : 1,
            };
          })
          .filter((q): q is QuizQuestion => q !== null)
      : [];
    return { instructions, passingScorePercent, questions };
  } catch {
    return { instructions, passingScorePercent: 70, questions: [] };
  }
}

/**
 * Serializes lesson reading notes alongside supplementary external resource
 * links into the lesson `description` column.
 */
export function serializeLessonResources(input: {
  notes?: string;
  links: LessonResourceLink[];
}): string {
  const cleanNotes = getCleanLessonDescription(input.notes ?? "").slice(0, 2000);
  if (!input.links || input.links.length === 0) {
    return cleanNotes;
  }
  const links = input.links.map((l) => ({
    id: l.id.trim(),
    title: l.title.trim(),
    url: l.url.trim(),
    description: (l.description ?? "").trim(),
  }));
  const encoded = `${RESOURCES_MARKER_PREFIX}${JSON.stringify({ links })}${MARKER_SUFFIX}`;
  return cleanNotes ? `${cleanNotes}\n\n${encoded}` : encoded;
}

/**
 * Parses a lesson `description` into reading notes and supplementary external
 * resource links.
 */
export function parseLessonResources(rawDescription: string | null | undefined): {
  notes: string;
  links: LessonResourceLink[];
} {
  const notes = getCleanLessonDescription(rawDescription);
  if (!rawDescription) return { notes: "", links: [] };
  const startIdx = rawDescription.indexOf(RESOURCES_MARKER_PREFIX);
  if (startIdx === -1) return { notes, links: [] };
  const jsonStart = startIdx + RESOURCES_MARKER_PREFIX.length;
  const endIdx = rawDescription.indexOf(MARKER_SUFFIX, jsonStart);
  const rawJson = endIdx !== -1 ? rawDescription.slice(jsonStart, endIdx) : rawDescription.slice(jsonStart);
  try {
    const parsed = JSON.parse(rawJson) as { links?: unknown[] };
    const links = Array.isArray(parsed.links)
      ? parsed.links
          .map((item): LessonResourceLink | null => {
            if (!item || typeof item !== "object") return null;
            const rec = item as Record<string, unknown>;
            if (typeof rec.id !== "string" || typeof rec.title !== "string" || typeof rec.url !== "string") {
              return null;
            }
            return {
              id: rec.id,
              title: rec.title,
              url: rec.url,
              description: typeof rec.description === "string" ? rec.description : "",
            };
          })
          .filter((l): l is LessonResourceLink => l !== null)
      : [];
    return { notes, links };
  } catch {
    return { notes, links: [] };
  }
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

export const LESSON_KINDS = ["video", "reading", "quiz"] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];

export const lessonSchema = z.object({
  courseId: z.string().uuid(),
  id: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "Lesson title is required").max(160),
  description: z.string().trim().max(50000).optional(),
  kind: z.enum(LESSON_KINDS).default("video"),
  sortOrder: z.number().int().min(0).max(9999),
  durationMinutes: z.number().int().min(0).max(600).default(0),
  isPreview: z.boolean().default(false),
  quizConfig: quizConfigSchema.optional(),
  resourceLinks: z.array(lessonResourceLinkSchema).max(30).optional(),
});

export type CourseDetailsInput = z.infer<typeof courseSchema>;
export type SectionInput = z.infer<typeof sectionSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;

export { inrPriceInputSchema };
