/**
 * Course creation wizard contract tests.
 *
 * The wizard must never claim more than the server will honour. These tests
 * lock down the pure logic behind the four-step workflow:
 *
 *   1. step navigation — which steps exist, where they link, what unlocks them,
 *   2. completion state — derived only from real saved fields, never from
 *      client-side wizard state,
 *   3. submission readiness — the same checklist the publish page renders and
 *      `submitCourseForReview` enforces, and
 *   4. input validation — the zod schemas the server actions parse against.
 */

import assert from "node:assert/strict";
import { test, before } from "node:test";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

before(async () => {
  register(new URL("./helpers/loader.mjs", import.meta.url), pathToFileURL("./"));
});

const wizard = await import("../src/lib/course-wizard.ts");

const COURSE_ID = "11111111-2222-4333-8444-555555555555";
const SECTION_ID = "66666666-7777-4888-8999-aaaaaaaaaaaa";

function draftState(overrides = {}) {
  return {
    courseId: COURSE_ID,
    title: "Build AI agents with Python",
    description: "A practical, project-based course.",
    categorySlug: "development",
    thumbnailKey: "courses/x/thumbnail.png",
    lessonsCount: 3,
    status: "draft",
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* 1. Step navigation                                                          */
/* -------------------------------------------------------------------------- */

test("steps stay locked until the course record exists", () => {
  const steps = wizard.buildCourseWizardSteps(draftState({ courseId: null, title: "", description: "", categorySlug: null, thumbnailKey: null, lessonsCount: 0 }));

  assert.equal(steps.length, 4);
  assert.deepEqual(
    steps.map((step) => step.title),
    ["Details & thumbnail", "Curriculum", "Pricing", "Review & submit"]
  );

  // Only step 1 is open, and it points at the create route.
  assert.equal(steps[0].href, "/creator/courses/new");
  assert.equal(steps[0].locked, false);
  for (const step of steps.slice(1)) {
    assert.equal(step.locked, true, `${step.title} must be locked before the first save`);
    assert.equal(step.href, null);
    assert.equal(step.done, false);
  }
});

test("every step links to its existing route once the course exists", () => {
  const steps = wizard.buildCourseWizardSteps(draftState());
  assert.deepEqual(
    steps.map((step) => step.href),
    [
      `/creator/courses/${COURSE_ID}/edit`,
      `/creator/courses/${COURSE_ID}/curriculum`,
      `/creator/courses/${COURSE_ID}/content`,
      `/creator/courses/${COURSE_ID}/publish`,
    ]
  );
  assert.ok(steps.every((step) => !step.locked));
});

test("completion follows saved state only — no step is done before its record exists", () => {
  // A course right after the first save: details exist, nothing else does.
  const afterFirstSave = wizard.buildCourseWizardSteps(draftState({ lessonsCount: 0, thumbnailKey: null }));
  assert.equal(afterFirstSave[0].done, true, "saved details complete step 1");
  assert.equal(afterFirstSave[1].done, false);
  assert.equal(afterFirstSave[2].done, true);
  assert.equal(afterFirstSave[3].done, false);

  // An unsaved title alone must not complete the step (e.g. details without
  // the required description or category).
  const incomplete = wizard.buildCourseWizardSteps(draftState({ description: "", categorySlug: null }));
  assert.equal(incomplete[0].done, false);

  // Curriculum completes when a lesson row actually exists.
  const withLesson = wizard.buildCourseWizardSteps(draftState({ lessonsCount: 1, thumbnailKey: null }));
  assert.equal(withLesson[1].done, true);

  // Pricing is informational: the step is complete for any saved course.
  const withThumb = wizard.buildCourseWizardSteps(draftState({ thumbnailKey: "k" }));
  assert.equal(withThumb[2].done, true);
  assert.equal(wizard.buildCourseWizardSteps(draftState({ thumbnailKey: null }))[2].done, true);
});

test("the review step is done only while a review is open or concluded", () => {
  const cases = {
    draft: false,
    changes_requested: false,
    rejected: false,
    archived: false,
    pending: true,
    published: true,
    unpublished: true,
  };
  for (const [status, expected] of Object.entries(cases)) {
    const steps = wizard.buildCourseWizardSteps(draftState({ status }));
    assert.equal(steps[3].done, expected, `status=${status}`);
  }
});

test("detail completion requires a real title, description and category", () => {
  assert.equal(wizard.detailsComplete("Teach", "Desc"), true);
  assert.equal(wizard.detailsComplete("ab", "Desc"), false);
  assert.equal(wizard.detailsComplete("Teach", "   "), false);
  assert.equal(wizard.categoryComplete("development"), true);
  assert.equal(wizard.categoryComplete(""), false);
  assert.equal(wizard.categoryComplete(null), false);
});

/* -------------------------------------------------------------------------- */
/* 2. Submission readiness                                                     */
/* -------------------------------------------------------------------------- */

function readyInput(overrides = {}) {
  return {
    courseId: COURSE_ID,
    title: "Build AI agents with Python",
    description: "A practical, project-based course.",
    categorySlug: "development",
    thumbnailKey: "courses/x/thumbnail.png",
    pricePaise: 0,
    lessons: [{ kind: "video", playbackReady: true, hasVideo: true }],
    ...overrides,
  };
}

test("an empty course is not ready and names every missing requirement", () => {
  const readiness = wizard.computeCourseReadiness({
    courseId: COURSE_ID,
    title: "",
    description: "",
    categorySlug: null,
    thumbnailKey: null,
    pricePaise: 0,
    lessons: [],
  });
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missing, [
    "Title and description",
    "Category selected",
    "At least one lesson",
    "Every lesson is ready",
    "Thumbnail uploaded",
  ]);
  // Every missing item points at the wizard step that can fix it.
  const fixes = readiness.checks.filter((check) => !check.done).map((check) => check.fixStep);
  assert.ok(fixes.includes("details"));
  assert.ok(fixes.includes("curriculum"));
});

test("a complete course satisfies every check", () => {
  const readiness = wizard.computeCourseReadiness(readyInput());
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.missing, []);
});

test("video lessons must finish encoding before submission", () => {
  const encoding = wizard.computeCourseReadiness(
    readyInput({ lessons: [{ kind: "video", playbackReady: false, hasVideo: true }] })
  );
  assert.equal(encoding.ready, false);
  assert.deepEqual(encoding.missing, ["Every lesson is ready"]);

  const noVideo = wizard.computeCourseReadiness(
    readyInput({ lessons: [{ kind: "video", playbackReady: false, hasVideo: false }] })
  );
  assert.equal(noVideo.ready, false);

  const ready = wizard.computeCourseReadiness(
    readyInput({ lessons: [{ kind: "video", playbackReady: true, hasVideo: true }] })
  );
  assert.equal(ready.ready, true);
});

test("reading and quiz lessons never block submission", () => {
  const readiness = wizard.computeCourseReadiness(
    readyInput({
      lessons: [
        { kind: "reading", playbackReady: false, hasVideo: false },
        { kind: "quiz", playbackReady: false, hasVideo: false },
      ],
    })
  );
  assert.equal(readiness.ready, true);
});

test("a missing thumbnail, category or description each block submission", () => {
  for (const override of [{ thumbnailKey: null }, { categorySlug: null }, { description: "" }, { title: "ab" }]) {
    const readiness = wizard.computeCourseReadiness(readyInput(override));
    assert.equal(readiness.ready, false, JSON.stringify(override));
    assert.ok(readiness.missing.length >= 1);
  }
});

test("pricing is informational: free and paid courses both satisfy it", () => {
  const free = wizard.computeCourseReadiness(readyInput({ pricePaise: 0 }));
  const paid = wizard.computeCourseReadiness(readyInput({ pricePaise: 149900 }));
  assert.equal(free.ready, true);
  assert.equal(paid.ready, true);
  const freePricing = free.checks.find((check) => check.id === "pricing");
  const paidPricing = paid.checks.find((check) => check.id === "pricing");
  assert.equal(freePricing.done, true);
  assert.equal(paidPricing.done, true);
  assert.match(freePricing.label, /Free/);
  assert.match(paidPricing.label, /INR/);
});

/* -------------------------------------------------------------------------- */
/* 3. Input validation                                                         */
/* -------------------------------------------------------------------------- */

test("course details validation mirrors the server rules", () => {
  const valid = {
    title: "Build AI agents with Python",
    subtitle: "Ship a working agent",
    description: "Long form description",
    categorySlug: "development",
    level: "intermediate",
    language: "English",
    priceRupees: "499.50",
    compareAtRupees: "999",
    whatYouLearn: ["Build agents"],
    requirements: ["Python"],
    audience: ["Developers"],
  };
  const parsed = wizard.courseSchema.parse(valid);
  assert.equal(parsed.title, valid.title);
  assert.equal(parsed.level, "intermediate");

  // Title: at least 3 characters.
  assert.equal(wizard.courseSchema.safeParse({ ...valid, title: "ab" }).success, false);
  const shortTitle = wizard.courseSchema.safeParse({ ...valid, title: "ab" });
  assert.match(shortTitle.error.issues[0].message, /course title/i);

  // Category is required.
  assert.equal(wizard.courseSchema.safeParse({ ...valid, categorySlug: "" }).success, false);

  // Level is a closed enum.
  assert.equal(wizard.courseSchema.safeParse({ ...valid, level: "expert" }).success, false);
  for (const level of ["beginner", "intermediate", "advanced"]) {
    assert.equal(wizard.courseSchema.safeParse({ ...valid, level }).success, true, level);
  }

  // Subtitle and description length caps.
  assert.equal(wizard.courseSchema.safeParse({ ...valid, subtitle: "x".repeat(181) }).success, false);
  assert.equal(wizard.courseSchema.safeParse({ ...valid, description: "x".repeat(6001) }).success, false);

  // List fields cap at 20 items.
  const twentyOne = Array.from({ length: 21 }, (_, i) => `item ${i}`);
  assert.equal(wizard.courseSchema.safeParse({ ...valid, whatYouLearn: twentyOne }).success, false);

  // Defaults apply when optional fields are omitted.
  const minimal = wizard.courseSchema.parse({ ...valid });
  assert.equal(minimal.compareAtRupees, "999");
  const bare = wizard.courseSchema.parse({
    title: "Minimal course",
    categorySlug: "development",
    level: "beginner",
    language: "English",
  });
  assert.equal(bare.priceRupees, "0");
  assert.deepEqual(bare.whatYouLearn, []);
});

test("prices are validated as INR amounts and stored as integer paise", () => {
  // This is the exact pipeline `saveCourse` runs: schema parse, then
  // `inrPriceInputSchema` converts rupees to integer paise.
  for (const [input, paise] of [
    ["499.50", 49950],
    ["0", 0],
    ["1000", 100000],
    [499, 49900],
  ]) {
    const price = wizard.inrPriceInputSchema.parse(input);
    assert.equal(price, paise, String(input));
  }
  for (const bad of ["", "abc", "-5", "10.999", 1e21]) {
    assert.equal(wizard.inrPriceInputSchema.safeParse(bad).success, false, String(bad));
  }
  // A zero price stays a free course, not an error.
  assert.equal(wizard.inrPriceInputSchema.parse("0"), 0);
});

test("section validation requires a title and sane ordering", () => {
  const valid = { courseId: COURSE_ID, title: "Getting started", sortOrder: 0 };
  assert.equal(wizard.sectionSchema.safeParse(valid).success, true);
  assert.equal(wizard.sectionSchema.safeParse({ ...valid, title: "  " }).success, false);
  assert.equal(wizard.sectionSchema.safeParse({ ...valid, sortOrder: -1 }).success, false);
  assert.equal(wizard.sectionSchema.safeParse({ ...valid, sortOrder: 1000 }).success, false);
  assert.equal(wizard.sectionSchema.safeParse({ ...valid, courseId: "not-a-uuid" }).success, false);
  // Editing an existing section carries its id.
  assert.equal(wizard.sectionSchema.safeParse({ ...valid, id: SECTION_ID }).success, true);
});

test("lesson validation covers the supported kinds, durations and previews", () => {
  const valid = {
    courseId: COURSE_ID,
    sectionId: SECTION_ID,
    title: "Your first agent",
    kind: "video",
    sortOrder: 0,
    durationMinutes: 12,
    isPreview: true,
  };
  const parsed = wizard.lessonSchema.parse(valid);
  assert.equal(parsed.kind, "video");
  assert.equal(parsed.isPreview, true);

  for (const kind of ["video", "reading", "quiz"]) {
    assert.equal(wizard.lessonSchema.safeParse({ ...valid, kind }).success, true, kind);
  }
  assert.equal(wizard.lessonSchema.safeParse({ ...valid, kind: "assignment" }).success, false);

  assert.equal(wizard.lessonSchema.safeParse({ ...valid, durationMinutes: -1 }).success, false);
  assert.equal(wizard.lessonSchema.safeParse({ ...valid, durationMinutes: 601 }).success, false);
  assert.equal(wizard.lessonSchema.safeParse({ ...valid, durationMinutes: 600 }).success, true);

  // Defaults: kind is video and previews are off unless opted in.
  const bare = wizard.lessonSchema.parse({ courseId: COURSE_ID, title: "Untitled lesson", sortOrder: 0 });
  assert.equal(bare.kind, "video");
  assert.equal(bare.isPreview, false);
  assert.equal(bare.durationMinutes, 0);
});
