/**
 * Creator studio presentation helpers.
 *
 * This module is pure: it formats real records that were fetched on the server
 * and holds no course, learner, earnings or transfer data of its own. Anything
 * that describes actual business state comes from `@/lib/server/creator`.
 */

import { formatInr, formatInrExact, paiseToRupees, type CommissionBps } from "@/lib/money";

/** Formats integer paise for display. Zybble is INR-only. */
export function money(paise: number): string {
  return formatInr(paise);
}

/** Exact, unambiguous money string, e.g. `₹1,299.00`. */
export function moneyExact(paise: number): string {
  return formatInrExact(paise);
}

export interface CourseStatusMeta {
  label: string;
  tone: "draft" | "published" | "pending" | "warning" | "error" | "neutral";
  description: string;
}

/**
 * Status presentation. `status` values come from the `course_status` enum; the
 * labels describe what the marketplace actually did, not what the UI hopes.
 */
export const STATUS_META: Record<string, CourseStatusMeta> = {
  draft: { label: "Draft", tone: "draft", description: "Visible only to you. Not listed anywhere." },
  pending: { label: "In review", tone: "pending", description: "An administrator is reviewing this submission." },
  changes_requested: { label: "Changes requested", tone: "warning", description: "Update the course and resubmit it for review." },
  published: { label: "Published", tone: "published", description: "Live in the public catalog." },
  unpublished: { label: "Unpublished", tone: "warning", description: "Removed from the public catalog by an administrator." },
  rejected: { label: "Rejected", tone: "error", description: "This submission was rejected. The reason is shown on the course." },
  archived: { label: "Archived", tone: "neutral", description: "Archived and not accepting new enrollments." },
};

export function statusMeta(status: string): CourseStatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status,
      tone: "neutral",
      description: "This course is not published.",
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Course slug                                                                */
/* -------------------------------------------------------------------------- */

/** URL-safe slug. Unicode is preserved so Indian-language titles stay readable. */
export function slugify(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Client-side identity for an unsaved draft row. Never persisted. */
export function draftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                  */
/* -------------------------------------------------------------------------- */

export interface SeriesPoint {
  label: string;
  /** Integer paise. */
  revenuePaise: number;
  enrollments: number;
}

/**
 * Reshapes real server-computed points for the chart components. It never
 * invents a value: an empty input produces an empty series.
 */
export function analyticsSeries(points: SeriesPoint[]): Array<{ label: string; value: number }> {
  return points.map((point) => ({ label: point.label, value: point.revenuePaise }));
}

/* -------------------------------------------------------------------------- */
/* Onboarding steps                                                           */
/* -------------------------------------------------------------------------- */

export const CREATOR_STEPS = [
  { id: "profile", title: "Creator profile", description: "Your public name, headline and username." },
  { id: "route", title: "Razorpay Route", description: "The linked account that receives your course earnings." },
  { id: "course", title: "Your first course", description: "Curriculum, pricing and a thumbnail." },
  { id: "review", title: "Submit for review", description: "An administrator reviews every course before it is listed." },
] as const;

export type CreatorStepId = (typeof CREATOR_STEPS)[number]["id"];

export function stepIndex(id: string): number {
  const index = CREATOR_STEPS.findIndex((step) => step.id === id);
  return index === -1 ? 0 : index;
}

/* -------------------------------------------------------------------------- */
/* Commission                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Commission is a **server setting**, snapshotted onto every order item at
 * checkout. This helper only re-derives the split for optimistic previews; the
 * authoritative figures always come from the stored order item.
 */
export function commissionOf(paise: number, commissionBps: CommissionBps): {
  commissionPaise: number;
  creatorSharePaise: number;
} {
  const commissionPaise = Math.round((paise * commissionBps) / 10_000);
  return { commissionPaise, creatorSharePaise: paise - commissionPaise };
}

/**
 * Minimum creator balance before a Route transfer is initiated, in paise.
 * Server-configured; the default is shown only when the setting is unavailable.
 */
export const DEFAULT_PAYOUT_THRESHOLD_PAISE = 1_000_00;

export function rupeesInputFromPaise(paise: number): string {
  return paiseToRupees(paise);
}

/* -------------------------------------------------------------------------- */
/* Course drafts                                                              */
/* -------------------------------------------------------------------------- */

export interface CourseDraft {
  title: string;
  subtitle: string;
  description: string;
  categorySlug: string;
  level: string;
  language: string;
  /** Integer paise. */
  pricePaise: number;
  outcomes: string[];
  requirements: string[];
  tags: string[];
}

export const EMPTY_COURSE_DRAFT: CourseDraft = {
  title: "",
  subtitle: "",
  description: "",
  categorySlug: "",
  level: "beginner",
  language: "English",
  pricePaise: 0,
  outcomes: [""],
  requirements: [""],
  tags: [],
};

/** Normalises an existing course into an editable draft. */
export function draftFromCourse(course: Partial<CourseDraft>): CourseDraft {
  return {
    ...EMPTY_COURSE_DRAFT,
    ...course,
    outcomes: course.outcomes?.length ? course.outcomes : [""],
    requirements: course.requirements?.length ? course.requirements : [""],
    tags: course.tags ?? [],
  };
}

export interface DraftStepErrors {
  [field: string]: string | undefined;
}

/** Validates one wizard step. Returns no errors when the step is valid. */
export function validateDraftStep(step: CreatorStepId, draft: CourseDraft): DraftStepErrors {
  const errors: DraftStepErrors = {};
  switch (step) {
    case "profile":
      if (!draft.title.trim()) errors.title = "Add a course title";
      break;
    case "course":
      if (!draft.title.trim()) errors.title = "Add a course title";
      if (!draft.categorySlug) errors.categorySlug = "Choose a category";
      if (draft.pricePaise < 0) errors.pricePaise = "Price cannot be negative";
      if (draft.pricePaise > 0) {
        errors.pricePaise =
          "Paid courses stay locked until Razorpay marks your Route account active.";
      }
      break;
    case "review":
      if (!draft.description.trim()) errors.description = "Add a course description";
      break;
    default:
      break;
  }
  return errors;
}