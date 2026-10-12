import type { Course, TutorCitation, TutorMessage } from "@/types";
import { flattenLessons } from "@/lib/learn";

/**
 * Deterministic mock AI Tutor. There is no AI API — responses are assembled
 * from the course's real curriculum metadata (section/lesson titles,
 * outcomes), so citations always point at lessons that actually exist in
 * THIS course. Unrelated questions get a graceful coverage notice.
 */

let _id = 0;
const mid = () => `tut_${Date.now().toString(36)}_${(++_id).toString(36)}`;

function lessonRef(course: Course, globalIndex: number): { citation: TutorCitation; flat: ReturnType<typeof flattenLessons>[number] } {
  const flat = flattenLessons(course);
  const f = flat[Math.min(globalIndex, flat.length - 1)];
  return {
    citation: {
      label: `Section ${f.sectionIndex + 1} · Lesson ${f.number} — “${f.lesson.title}”`,
      lessonId: f.lesson.id,
    },
    flat: f,
  };
}

export interface TutorAnswer {
  text: string;
  citations: TutorCitation[];
}

/** Suggested starter questions, derived from THIS course's curriculum. */
export function tutorSuggestions(course: Course, currentLessonId?: string): string[] {
  const flat = flattenLessons(course);
  const current = flat.find((f) => f.lesson.id === currentLessonId) ?? flat[0];
  const next = flat[current.globalIndex + 1];
  const suggestions = [
    `Explain “${current.lesson.title}” in simple terms`,
    `Quiz me on ${current.section.title}`,
    `What will I learn in this course?`,
  ];
  if (next) suggestions.push(`How does this lesson connect to “${next.lesson.title}”?`);
  return suggestions.slice(0, 4);
}

function coversTopic(course: Course, question: string): boolean {
  const q = question.toLowerCase();
  const haystack = [
    course.title,
    course.subtitle,
    course.description,
    ...course.tags,
    ...course.curriculum.flatMap((s) => [s.title, ...s.lessons.map((l) => l.title)]),
  ]
    .join(" ")
    .toLowerCase();
  // meaningful tokens (skip very common words)
  const tokens = q.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((t) => t.length > 3);
  const common = new Set(["what", "does", "this", "course", "about", "explain", "tell", "more", "with", "that", "from", "have", "will"]);
  const meaningful = tokens.filter((t) => !common.has(t));
  return meaningful.some((t) => haystack.includes(t));
}

export function answerTutor(course: Course, question: string, currentLessonId?: string): TutorAnswer {
  const flat = flattenLessons(course);
  const current = flat.find((f) => f.lesson.id === currentLessonId) ?? flat[0];
  const q = question.toLowerCase();

  /* Summary intent -------------------------------------------------------- */
  if (/(what will i learn|summari|overview|about this course|syllabus)/.test(q)) {
    const outcomes = course.whatYouLearn.slice(0, 4);
    const secA = lessonRef(course, 0);
    const secB = lessonRef(course, flat[Math.min(4, flat.length - 1)].globalIndex);
    return {
      text: `“${course.title}” is built around ${course.curriculum.length} sections. The key outcomes are:\n\n${outcomes.map((o) => `• ${o}`).join("\n")}\n\nI'd start with “${secA.flat.lesson.title}” and then look at section ${secB.flat.sectionIndex + 1}, which most students find the most valuable.`,
      citations: [secA.citation, secB.citation],
    };
  }

  /* Quiz intent ----------------------------------------------------------- */
  if (/(quiz|test me|ask me|practice)/.test(q)) {
    const scope = current;
    return {
      text: `Let's practice “${scope.section.title}”. Three quick questions:${flat
        .filter((f) => f.sectionIndex === scope.sectionIndex)
        .slice(0, 3)
        .map((f, i) => `\n\n${i + 1}. In your own words, what is the goal of “${f.lesson.title}”?`)
        .join("")}\n\nAnswer them out loud, then replay any lesson you hesitated on. (Preview mode — AI is not connected, so these are generated from lesson titles, not a live model.)`,
      citations: [
        lessonRef(course, scope.sectionIndex === 0 ? 0 : flat.find((f) => f.sectionIndex === scope.sectionIndex)!.globalIndex).citation,
      ],
    };
  }

  /* Reference to current/next lesson -------------------------------------- */
  if (/(this lesson|current lesson|explain|connect|next lesson|relate)/.test(q) && coversTopic(course, question)) {
    const next = flat[current.globalIndex + 1];
    const text = next
      ? `“${current.lesson.title}” (lesson ${current.number}) sets up the foundations for what comes next. Think of it as: first you learn the concept here, then lesson ${next.number} — “${next.lesson.title}” — puts it to work.\n\nIf this lesson feels dense, replay its free preview and write one sentence in your notes about what felt unclear; that's usually what to revisit.`
      : `“${current.lesson.title}” is the final lesson of this course — it ties the earlier sections together. A good way to consolidate: re-skim the section titles and check you can explain each in one sentence.`;
    return {
      text: `${text}\n\n(Preview mode — AI is not connected. This explanation is assembled from the course structure, not a language model.)`,
      citations: [
        lessonRef(course, current.globalIndex).citation,
        ...(next ? [lessonRef(course, next.globalIndex).citation] : []),
      ],
    };
  }

  /* Question covered by the course ---------------------------------------- */
  if (coversTopic(course, question)) {
    // find the best-matching lesson by token overlap
    const qTokens = q.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((t) => t.length > 3);
    let best = flat[0];
    let bestScore = 0;
    for (const f of flat) {
      const title = f.lesson.title.toLowerCase();
      const score = qTokens.reduce((a, t) => (title.includes(t) ? a + 1 : a), 0);
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return {
      text: `Good question — this is covered in this course. The key idea, as taught in “${best.lesson.title}” (lesson ${best.number}), is to approach it step by step: understand the concept, watch the worked example, then reproduce it yourself.\n\nI'd recommend: 1) replay lesson ${best.number}, 2) do the related exercise, 3) write one sentence in your notes summarizing it in your own words.\n\n(Preview mode — AI is not connected. This guidance is assembled from the course curriculum, not retrieved from a live knowledge base.)`,
      citations: [lessonRef(course, best.globalIndex).citation],
    };
  }

  /* Not covered ----------------------------------------------------------- */
  const coverage = course.curriculum
    .slice(0, 4)
    .map((s, i) => `• Section ${i + 1}: ${s.title}`)
    .join("\n");
  return {
    text: `This course material doesn't cover that topic — and I can only answer questions about “${course.title}”. Nothing was sent to an external model.\n\nHere's what I *can* help with:\n${coverage}\n\nTry asking about one of these sections, or open a different course if you want to explore that topic.`,
    citations: [],
  };
}

export function tutorMessage(role: TutorMessage["role"], text: string, citations: TutorCitation[] = []): TutorMessage {
  return { id: mid(), role, text, at: new Date().toISOString(), citations };
}

export function tutorGreeting(course: Course): TutorMessage {
  return tutorMessage(
    "assistant",
    `Hi! I'm your AI Tutor for “${course.title}”. I only answer questions about this course — its ${course.curriculum.length} sections and ${course.lessonsCount} lessons.\n\nPreview mode — AI is not connected: my answers are assembled locally from the course curriculum, with citations to the exact lessons.`
  );
}
