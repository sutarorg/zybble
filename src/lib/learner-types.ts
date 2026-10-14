/**
 * Learner view models.
 *
 * Kept free of `server-only` so client components can type the props they
 * receive from a server page without pulling a database module into the
 * browser bundle. The *values* are always produced by `src/lib/server/learner.ts`
 * under the caller's own RLS scope.
 */

export interface LearnerCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  thumbnailKey: string | null;
  pricePaise: number;
  creatorName: string;
  creatorUsername: string | null;
  durationMinutes: number;
  lessonsCount: number;
  level: string;
  categorySlug: string | null;
  categoryName: string | null;
}

export interface LearnerOrder {
  id: string;
  publicId: string;
  status: string;
  currency: "INR";
  totalPaise: number;
  isFree: boolean;
  createdAt: string;
  paidAt: string | null;
  method: string;
  items: Array<{
    courseId: string;
    courseSlug: string;
    courseTitle: string;
    thumbnailKey: string | null;
    unitPricePaise: number;
    commissionBps: number;
    creatorSharePaise: number;
  }>;
}

export interface LearnerEnrollment {
  course: LearnerCourse;
  enrolledAt: string;
  progressPercent: number;
  completedCount: number;
  totalLessons: number;
  lastLessonId: string | null;
  lastVisitedAt: string | null;
}

export interface LearnerCertificate {
  id: string;
  verificationCode: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  instructorName: string;
  lessonsCount: number;
  durationMinutes: number;
  issuedAt: string;
}
