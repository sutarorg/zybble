/**
 * Learning-session helpers.
 *
 * Pure functions over lesson, progress and entitlement records that the server
 * already fetched and authorised. The browser never decides whether a learner
 * may watch a lesson — it only renders what the server returned.
 */

export interface FlatSection {
  id: string;
  title: string;
  sortOrder: number;
  lessons: FlatLesson[];
}

export interface FlatLesson {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  kind: string;
  sortOrder: number;
  durationMinutes: number;
  isPreview: boolean;
  /** True only when Bunny Stream reports the video finished encoding. */
  playbackReady: boolean;
  /** Set when the server could not verify playback rights. */
  blockedReason?: string | null;
}

interface RawSection extends Omit<FlatSection, "sortOrder"> {
  sortOrder?: number;
}

interface RawLesson extends Omit<FlatLesson, "sectionId" | "sortOrder" | "playbackReady"> {
  sectionId?: string;
  sortOrder?: number;
  bunny_playback_ready?: boolean | null;
  bunny_status?: string | null;
  playbackReady?: boolean | null;
}

/** Flattens the section/lesson tree into the player's lesson rail. */
export function flattenLessons(sections: RawSection[]): FlatLesson[] {
  return sections
    .flatMap((section) =>
      (section.lessons ?? []).map((lesson: RawLesson) => ({
        id: lesson.id,
        sectionId: lesson.sectionId ?? section.id,
        title: lesson.title,
        description: lesson.description ?? "",
        kind: lesson.kind ?? "video",
        sortOrder: Number(lesson.sortOrder ?? 0),
        durationMinutes: Number(lesson.durationMinutes ?? 0),
        isPreview: Boolean(lesson.isPreview),
        playbackReady: Boolean(lesson.playbackReady ?? lesson.bunny_playback_ready ?? false),
      }))
    )
    .sort((a, b) => a.sectionId.localeCompare(b.sectionId) || a.sortOrder - b.sortOrder);
}

export interface LessonProgress {
  completed: boolean;
  lastPositionSeconds: number;
  updatedAt: string | null;
}

export interface CourseProgress {
  completedLessons: number;
  totalLessons: number;
  percent: number;
  nextLessonId: string | null;
  lastLessonId: string | null;
}

/** Computes learner progress from real `lesson_progress` rows. */
export function progressOf(
  lessons: FlatLesson[],
  progress: Array<{ lesson_id: string; completed: boolean; position_seconds: number; updated_at: string | null }>
): CourseProgress {
  const totalLessons = lessons.length;
  const byId = new Map(progress.map((row) => [row.lesson_id, row]));
  const completedLessons = lessons.filter((lesson) => byId.get(lesson.id)?.completed).length;

  const firstIncomplete = lessons.find((lesson) => !byId.get(lesson.id)?.completed);
  let lastLessonId: string | null = null;
  let latest = "";
  for (const lesson of lessons) {
    const row = byId.get(lesson.id);
    if (row?.updated_at && row.updated_at > latest) {
      latest = row.updated_at;
      lastLessonId = lesson.id;
    }
  }

  return {
    completedLessons,
    totalLessons,
    percent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    nextLessonId: firstIncomplete?.id ?? lessons[0]?.id ?? null,
    lastLessonId,
  };
}

export function nextLessonOf(lessons: FlatLesson[], currentId: string): FlatLesson | null {
  const index = lessons.findIndex((lesson) => lesson.id === currentId);
  return index === -1 ? null : lessons[index + 1] ?? null;
}

export function prevLessonOf(lessons: FlatLesson[], currentId: string): FlatLesson | null {
  const index = lessons.findIndex((lesson) => lesson.id === currentId);
  return index <= 0 ? null : lessons[index - 1];
}

export interface LessonInstructor {
  displayName: string;
  avatarUrl: string | null;
}

/** Reads the verified course instructor; there is no fallback identity. */
export function instructorOf(course: { creatorDisplayName: string | null; creatorAvatarUrl: string | null } | null): LessonInstructor {
  return {
    displayName: course?.creatorDisplayName ?? "This creator",
    avatarUrl: course?.creatorAvatarUrl ?? null,
  };
}

/** True when every lesson is completed and the course has at least one lesson. */
export function hasCompletedCourse(progress: CourseProgress): boolean {
  return progress.totalLessons > 0 && progress.completedLessons === progress.totalLessons;
}