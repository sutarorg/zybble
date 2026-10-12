import { COURSES, INSTRUCTORS } from "@/data/mock-data";
import type {
  AnalyticsPoint,
  AnalyticsRange,
  CourseDraft,
  CourseStatus,
  CreatorCourse,
  CreatorNotification,
  CreatorProfile,
  CreatorResource,
  CurriculumSection,
  EarningTransaction,
  Lesson,
  PayoutRecord,
} from "@/types";

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Zybble marketplace commission: 10% of gross sales (illustrative). */
export const PLATFORM_COMMISSION = 0.1;

/** Minimum balance needed before a payout can be requested (illustrative). */
export const PAYOUT_THRESHOLD_USD = 50;

/** The instructor persona the creator workspace represents in this demo. */
export const CREATOR_INSTRUCTOR_ID = "ins_maya";

/* -------------------------------------------------------------------------- */
/* Small utilities                                                             */
/* -------------------------------------------------------------------------- */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "course";
}

let _uid = 0;
export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(++_uid).toString(36)}`;
}

/** Deterministic PRNG so charts are stable between renders. */
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);

export const moneyExact = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/* -------------------------------------------------------------------------- */
/* Status metadata                                                             */
/* -------------------------------------------------------------------------- */

export const STATUS_META: Record<
  CourseStatus,
  {
    label: string;
    badge: "secondary" | "amber" | "emerald" | "sky" | "violet";
    dot: string;
    description: string;
  }
> = {
  draft: {
    label: "Draft",
    badge: "secondary",
    dot: "bg-zinc-400",
    description: "Only visible to you. Submit for review when it's ready.",
  },
  pending: {
    label: "Pending Review",
    badge: "amber",
    dot: "bg-amber-500",
    description: "Submitted and waiting in the (simulated) review queue.",
  },
  published: {
    label: "Published",
    badge: "emerald",
    dot: "bg-emerald-500",
    description: "Live in the public catalog for learners to enroll.",
  },
  changes_requested: {
    label: "Changes Requested",
    badge: "sky",
    dot: "bg-sky-500",
    description: "The review team asked for adjustments before publishing.",
  },
  rejected: {
    label: "Rejected",
    badge: "violet",
    dot: "bg-red-500",
    description: "Not approved in its current form. See reviewer notes.",
  },
};

export const CREATOR_STEPS = [
  "Basics",
  "Outcomes",
  "Thumbnail",
  "Pricing",
  "Curriculum",
  "Content",
  "Preview",
  "Submit",
] as const;

/* -------------------------------------------------------------------------- */
/* Seed data                                                                   */
/* -------------------------------------------------------------------------- */

export function seedCreatorProfile(): CreatorProfile {
  const instructor = INSTRUCTORS.find((i) => i.id === CREATOR_INSTRUCTOR_ID)!;
  return {
    instructorId: instructor.id,
    displayName: instructor.name,
    headline: instructor.headline,
    bio: instructor.bio,
    country: instructor.country,
    languages: [...instructor.languages],
    initials: instructor.initials,
    avatarColor: instructor.avatarColor,
    website: "https://mayalindqvist.ai",
    topics: ["chatgpt", "prompting", "productivity"],
    onboardedAt: "2025-10-20T09:00:00.000Z",
  };
}

function ev(
  daysAgo: number,
  status: CourseStatus,
  actor: "creator" | "reviewer",
  note?: string
) {
  return {
    id: `rev_${status}_${daysAgo}_${actor}`,
    at: new Date(Date.now() - daysAgo * 86400_000).toISOString(),
    status,
    actor,
    note,
  };
}

export function seedCreatorCourses(): CreatorCourse[] {
  const owned = COURSES.filter((c) => c.instructorId === CREATOR_INSTRUCTOR_ID);
  const published: CreatorCourse[] = owned.map((course, i) => ({
    ...course,
    status: "published",
    reviewHistory: [
      ev(i === 0 ? 420 : 210, "pending", "creator", "Submitted for review."),
      ev(i === 0 ? 417 : 208, "published", "reviewer", "Approved — course meets marketplace quality standards."),
    ],
    demoRevenue: i === 0 ? 382140 : 0, // flagship earns; free course earns nothing directly
  }));

  const pendingCourse: CreatorCourse = {
    ...owned[0],
    id: "crs_gpt_teams",
    slug: "chatgpt-for-teams",
    title: "ChatGPT for Teams: Shared Workflows That Scale",
    subtitle: "Roll out ChatGPT across a team: shared GPTs, prompt standards, workspace admin and adoption playbooks.",
    description: "Roll out ChatGPT across a team: shared GPTs, prompt standards, workspace admin and adoption playbooks.",
    longDescription: [
      "Rolling out ChatGPT to fifty people is a change-management project, not a software install. This course gives team leads the complete playbook: workspace setup, shared GPTs, prompt standards, security preferences and a 30-day adoption plan.",
      "Built from Maya's rollout work with three Fortune-500 teams, including the pitfalls that kill adoption in week two.",
    ],
    price: 79.99,
    compareAtPrice: 99.99,
    rating: 0,
    ratingsCount: 0,
    studentsCount: 0,
    badge: undefined,
    curriculum: owned[0].curriculum.slice(0, 3).map((s, i) => ({
      ...s,
      id: `sec_teams_${i}`,
      lessons: s.lessons.map((l, j) => ({ ...l, id: `les_teams_${i}_${j}` })),
    })),
    createdAt: new Date(Date.now() - 9 * 86400_000).toISOString(),
    lastUpdated: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: "pending",
    reviewHistory: [
      ev(9, "draft", "creator", "Curriculum mapped from team rollout notes."),
      ev(2, "pending", "creator", "Submitted for review — all checks green."),
    ],
    demoRevenue: 0,
  };

  const changesCourse: CreatorCourse = {
    ...owned[0],
    id: "crs_vision",
    slug: "chatgpt-vision-mastery",
    title: "ChatGPT Vision Mastery",
    subtitle: "From screenshots to insights: multimodal prompting for analysis, accessibility and creative work.",
    description: "From screenshots to insights: multimodal prompting for analysis, accessibility and creative work.",
    longDescription: [
      "Vision is the most under-used ChatGPT capability. This course teaches a repeatable method for turning screenshots, photos, diagrams and documents into structured, reliable insights.",
    ],
    price: 49.99,
    compareAtPrice: 69.99,
    rating: 0,
    ratingsCount: 0,
    studentsCount: 0,
    badge: undefined,
    curriculum: [owned[0].curriculum[0]].map((s, i) => ({
      ...s,
      id: `sec_vision_${i}`,
      lessons: s.lessons.map((l, j) => ({ ...l, id: `les_vision_${i}_${j}` })),
    })),
    createdAt: new Date(Date.now() - 40 * 86400_000).toISOString(),
    lastUpdated: new Date(Date.now() - 5 * 86400_000).toISOString(),
    status: "changes_requested",
    reviewHistory: [
      ev(40, "draft", "creator", "First outline and two sample lessons recorded."),
      ev(33, "pending", "creator", "Submitted for review."),
      ev(31, "changes_requested", "reviewer", "Great material. Please add alt-text guidance to lesson 2.1 and a privacy note about uploading sensitive screenshots, then resubmit."),
    ],
    demoRevenue: 0,
  };

  const draftCourse: CreatorCourse = {
    ...owned[1],
    id: "crs_prompt_systems",
    slug: "advanced-prompt-systems",
    title: "Advanced Prompt Systems",
    subtitle: "Design reusable prompt architectures: libraries, evaluation harnesses and team documentation.",
    description: "Design reusable prompt architectures: libraries, evaluation harnesses and team documentation.",
    longDescription: [
      "The sequel to Prompt Engineering Foundations, for people ready to treat prompts as engineered artifacts: versioned, tested and documented like code.",
    ],
    price: 64.99,
    badge: undefined,
    rating: 0,
    ratingsCount: 0,
    studentsCount: 0,
    curriculum: [],
    createdAt: new Date(Date.now() - 15 * 86400_000).toISOString(),
    lastUpdated: new Date(Date.now() - 1 * 86400_000).toISOString(),
    status: "draft",
    reviewHistory: [ev(15, "draft", "creator", "Course created — outline in progress.")],
    demoRevenue: 0,
  };

  return [draftCourse, changesCourse, ...published, pendingCourse];
}

/** Notifications tailored to the creator workspace. */
export function seedCreatorNotifications(): CreatorNotification[] {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  return [
    { id: "cn1", title: "Review submitted", body: "ChatGPT for Teams is now in the review queue.", kind: "review", createdAt: hoursAgo(6), href: "/creator/courses/crs_gpt_teams/publish" },
    { id: "cn2", title: "Changes requested", body: "ChatGPT Vision Mastery needs two small fixes before approval.", kind: "review", createdAt: hoursAgo(30), href: "/creator/courses/crs_vision/publish" },
    { id: "cn3", title: "Payout processed", body: "$2,483.20 was sent to your bank account ending ••4821.", kind: "payout", createdAt: hoursAgo(52), href: "/creator/payouts" },
    { id: "cn4", title: "New 5-star review", body: "“Worth every cent” — Sarah K. on Complete ChatGPT Masterclass.", kind: "sale", createdAt: hoursAgo(78), href: "/creator/reviews" },
    { id: "cn5", title: "Welcome to the Creator Studio", body: "Your studio is a local demo — changes save to this browser only.", kind: "system", createdAt: hoursAgo(96), href: "/creator" },
  ];
}

/* -------------------------------------------------------------------------- */
/* Analytics (illustrative, deterministic)                                     */
/* -------------------------------------------------------------------------- */

export function analyticsSeries(range: AnalyticsRange, baseRevenue: number, baseEnrollments: number): AnalyticsPoint[] {
  const config: Record<AnalyticsRange, { points: number; seed: number; fmt: (i: number, n: number) => string }> = {
    "7d": { points: 7, seed: 42, fmt: (i) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i] },
    "30d": { points: 30, seed: 84, fmt: (i) => `${i + 1}` },
    "90d": { points: 30, seed: 128, fmt: (i) => `W${Math.floor(i / 3) + 1}` },
    "1y": { points: 12, seed: 256, fmt: (i) => ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"][i] },
  };
  const { points, seed, fmt } = config[range];
  const rand = mulberry32(seed);
  const dailyRev = baseRevenue / 30;
  const dailyEnr = baseEnrollments / 30;
  return Array.from({ length: points }, (_, i) => {
    const weekly = 1 + 0.35 * Math.sin((i / points) * Math.PI * 2);
    const noise = 0.55 + rand() * 0.9;
    const trend = 0.75 + (i / points) * 0.5;
    return {
      label: fmt(i, points),
      revenue: Math.round(dailyRev * weekly * noise * trend * 100) / 100,
      enrollments: Math.max(1, Math.round(dailyEnr * weekly * noise * trend)),
    };
  });
}

/** Illustrative baseline used to scale demo analytics. */
export const ANALYTICS_BASE = { revenue30d: 4200, enrollments30d: 310 };

export function seedEarningTransactions(courses: CreatorCourse[]): EarningTransaction[] {
  const paidCourses = courses.filter((c) => c.status === "published" && c.price > 0);
  const titles: Record<string, string> = {};
  for (const c of courses) titles[c.id] = c.title;
  const rand = mulberry32(2026);
  const rows: EarningTransaction[] = [];
  const now = Date.now();
  const count = 26;
  for (let i = 0; i < count; i++) {
    const course = paidCourses[i % paidCourses.length];
    if (!course) break;
    const date = new Date(now - Math.floor(rand() * 88) * 86400_000 - i * 3600_000);
    const gross = course.price;
    const roll = rand();
    const status: EarningTransaction["status"] = roll > 0.94 ? "refunded" : roll > 0.82 ? "pending" : "paid";
    rows.push({
      id: `txn_${i}`,
      date: date.toISOString(),
      courseId: course.id,
      courseTitle: course.title,
      orderRef: `Z-2026-${String(4000 + Math.floor(rand() * 900)).padStart(4, "0")}`,
      status,
      gross,
      commission: Math.round(gross * PLATFORM_COMMISSION * 100) / 100,
      net: Math.round((gross - gross * PLATFORM_COMMISSION) * 100) / 100,
    });
  }
  return rows.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function seedPayouts(): PayoutRecord[] {
  const months: { period: string; amount: number }[] = [
    { period: "October 2025", amount: 2140.5 },
    { period: "November 2025", amount: 2483.2 },
    { period: "December 2025", amount: 3012.75 },
    { period: "January 2026", amount: 2890.4 },
    { period: "February 2026", amount: 2655.1 },
    { period: "March 2026", amount: 3120.0 },
  ];
  const payouts: PayoutRecord[] = months.map((m, i) => ({
    id: `pay_${i}`,
    period: m.period,
    amount: m.amount,
    status: "paid",
    method: "Bank ••4821",
    reference: `PO-202${5 + Math.floor(i / 3)}-${String(118 + i * 7)}`,
    requestedAt: new Date(Date.now() - (30 * (months.length - i) + 12) * 86400_000).toISOString(),
  }));
  payouts.push({
    id: "pay_processing",
    period: "April 2026",
    amount: 1740.0,
    status: "processing",
    method: "Bank ••4821",
    reference: "PO-2026-160",
    requestedAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
  });
  return payouts;
}

/* -------------------------------------------------------------------------- */
/* Draft helpers                                                               */
/* -------------------------------------------------------------------------- */

export function emptyCourseDraft(): CourseDraft {
  return {
    title: "",
    subtitle: "",
    description: "",
    category: "",
    level: "beginner",
    language: "English",
    outcomes: ["", "", "", ""],
    requirements: [""],
    audience: [""],
    thumbnail: "",
    isFree: false,
    price: 49.99,
    compareAtPrice: null,
    hasAiTutor: true,
    sections: [],
    draftResources: [],
  };
}

export function draftFromCourse(course: CreatorCourse): CourseDraft {
  return {
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    category: course.category,
    level: course.level,
    language: course.language,
    outcomes: [...course.whatYouLearn],
    requirements: [...course.requirements],
    audience: [...course.audience],
    thumbnail: course.thumbnail,
    isFree: course.price === 0,
    price: course.price === 0 ? 49.99 : course.price,
    compareAtPrice: course.compareAtPrice ?? null,
    hasAiTutor: course.hasAiTutor,
    sections: course.curriculum.map((s) => ({
      ...s,
      lessons: s.lessons.map((l) => ({ ...l })),
    })),
    draftResources: [],
  };
}

export function applyDraftToCourse(course: CreatorCourse, draft: CourseDraft): CreatorCourse {
  const price = draft.isFree ? 0 : Math.max(0, Math.round(draft.price * 100) / 100);
  return {
    ...course,
    title: draft.title.trim(),
    subtitle: draft.subtitle.trim() || draft.description.trim().slice(0, 140),
    description: draft.description.trim(),
    longDescription: draft.description.trim() ? [draft.description.trim()] : course.longDescription,
    category: (draft.category || course.category) as CreatorCourse["category"],
    level: draft.level,
    language: draft.language,
    thumbnail: draft.thumbnail || course.thumbnail,
    price,
    compareAtPrice: !draft.isFree && draft.compareAtPrice && draft.compareAtPrice > price ? draft.compareAtPrice : undefined,
    whatYouLearn: draft.outcomes.map((o) => o.trim()).filter(Boolean),
    requirements: draft.requirements.map((r) => r.trim()).filter(Boolean),
    audience: draft.audience.map((a) => a.trim()).filter(Boolean),
    hasAiTutor: draft.hasAiTutor,
    curriculum: draft.sections,
    lessonsCount: draft.sections.reduce((n, s) => n + s.lessons.length, 0),
    durationMinutes: draft.sections.reduce(
      (n, s) => n + s.lessons.reduce((m, l) => m + l.durationMinutes, 0),
      0
    ),
    lastUpdated: new Date().toISOString(),
  };
}

export function newCourseFromDraft(draft: CourseDraft): CreatorCourse {
  const base: CreatorCourse = {
    id: uid("crs"),
    slug: slugify(draft.title),
    title: draft.title.trim(),
    subtitle: draft.subtitle.trim(),
    description: draft.description.trim(),
    longDescription: [draft.description.trim()],
    category: (draft.category || "generative-ai") as CreatorCourse["category"],
    instructorId: CREATOR_INSTRUCTOR_ID,
    thumbnail: draft.thumbnail,
    price: draft.isFree ? 0 : Math.max(0, Math.round(draft.price * 100) / 100),
    rating: 0,
    ratingsCount: 0,
    studentsCount: 0,
    level: draft.level,
    language: draft.language,
    captions: [draft.language],
    durationMinutes: 0,
    lessonsCount: 0,
    hasAiTutor: draft.hasAiTutor,
    downloadableResources: draft.draftResources.length,
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    whatYouLearn: draft.outcomes.map((o) => o.trim()).filter(Boolean),
    curriculum: draft.sections,
    requirements: draft.requirements.map((r) => r.trim()).filter(Boolean),
    audience: draft.audience.map((a) => a.trim()).filter(Boolean),
    tags: [],
    status: "draft",
    reviewHistory: [
      {
        id: uid("rev"),
        at: new Date().toISOString(),
        status: "draft",
        actor: "creator",
        note: "Course created with the course builder.",
      },
    ],
    demoRevenue: 0,
  };
  if (!draft.isFree && draft.compareAtPrice && draft.compareAtPrice > base.price) {
    base.compareAtPrice = draft.compareAtPrice;
  }
  base.lessonsCount = base.curriculum.reduce((n, s) => n + s.lessons.length, 0);
  base.durationMinutes = base.curriculum.reduce(
    (n, s) => n + s.lessons.reduce((m, l) => m + l.durationMinutes, 0),
    0
  );
  return base;
}

/** Validation per wizard step. Returns a map of field → error. */
export function validateDraftStep(step: number, draft: CourseDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 0) {
    if (draft.title.trim().length < 4) errors.title = "Give your course a title (4+ characters).";
    if (!draft.subtitle.trim()) errors.subtitle = "Add a short subtitle — learners see this in cards.";
    if (draft.description.trim().length < 40) errors.description = "Describe the course in at least 40 characters.";
    if (!draft.category) errors.category = "Pick a category.";
  }
  if (step === 1) {
    const outcomes = draft.outcomes.map((o) => o.trim()).filter(Boolean);
    if (outcomes.length < 2) errors.outcomes = "Add at least 2 learning outcomes.";
  }
  if (step === 2) {
    if (!draft.thumbnail) errors.thumbnail = "Choose a thumbnail image.";
  }
  if (step === 3) {
    if (!draft.isFree && (!draft.price || draft.price < 4.99)) errors.price = "Paid courses start at $4.99.";
    if (!draft.isFree && draft.compareAtPrice != null && draft.compareAtPrice <= draft.price)
      errors.compareAtPrice = "Compare-at price must be higher than the price.";
  }
  if (step === 4) {
    const lessons = draft.sections.reduce((n, s) => n + s.lessons.length, 0);
    if (draft.sections.length === 0 || lessons === 0)
      errors.sections = "Add at least one section with one lesson.";
  }
  return errors;
}

/* Re-export for convenience in editors */
export type { Lesson, CurriculumSection, CreatorResource };
