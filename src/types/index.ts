/**
 * Shared domain types for Zybble.
 * These types are reused by the public marketplace (Prompt 1) and will be
 * reused by the creator, learner and admin interfaces in later phases.
 */

export type CategorySlug =
  | "automation"
  | "development"
  | "generative-ai"
  | "creation"
  | "marketing"
  | "data-science"
  | "business"
  | "productivity";

export interface Category {
  slug: CategorySlug;
  name: string;
  shortName: string;
  description: string;
  icon: string; // lucide icon key
}

export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type CourseLanguage = "English" | "Spanish" | "Portuguese";
export type CourseBadge = "bestseller" | "popular" | "new";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  /** Index into `options` of the correct answer. */
  correctIndex: number;
}

/** Local-preview metadata for a lesson's uploaded video or resource file. */
export interface LessonMedia {
  fileName: string;
  fileSize: number;
  /** Detected from the file name — e.g. "mp4", "pdf", "zip". */
  extension: string;
  kind: "video" | "resource";
}

export interface Lesson {
  id: string;
  title: string;
  /**
   * Minutes of video. Lessons without playback time (quizzes, resources) use
   * `0` — the UI renders those as "Untimed quiz" / "Reference file".
   */
  durationMinutes: number;
  type: "video" | "reading" | "quiz" | "resource";
  description?: string;
  freePreview?: boolean;
  downloadable?: boolean;
  /** Quiz lessons only. */
  quiz?: QuizQuestion[];
  /** Uploaded file metadata (video and resource lessons). */
  media?: LessonMedia;
}

export interface CurriculumSection {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Instructor {
  id: string;
  username: string;
  name: string;
  headline: string;
  bio: string;
  initials: string;
  avatarColor: string; // tailwind class for initials avatar
  country: string;
  languages: string[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  longDescription: string[];
  category: CategorySlug;
  instructorId: string;
  /** Author snapshot for courses created during this session. */
  instructor?: Instructor;
  thumbnail: string; // path under /images/courses
  price: number; // USD, 0 = free
  compareAtPrice?: number;
  rating: number; // 0–5
  ratingsCount: number;
  studentsCount: number;
  level: CourseLevel;
  language: CourseLanguage;
  captions: string[];
  durationMinutes: number;
  lessonsCount: number;
  badge?: CourseBadge;
  downloadableResources: number; // count, 0 = none
  lastUpdated: string; // ISO date
  createdAt: string; // ISO date
  whatYouLearn: string[];
  curriculum: CurriculumSection[];
  requirements: string[];
  audience: string[];
  tags: string[];
}

export interface Review {
  id: string;
  courseId: string;
  author: string;
  initials: string;
  avatarColor: string;
  rating: number;
  date: string; // ISO
  title: string;
  text: string;
  role?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatar?: string;
  role?: "learner" | "creator" | "admin";
}

export interface Order {
  id: string;
  courseId: string;
  userId: string | null;
  email: string;
  total: number;
  createdAt: string; // ISO
  status: "paid" | "failed";
  cardLast4: string;
}

export interface Enrollment {
  courseId: string;
  orderId: string;
  enrolledAt: string; // ISO
  progress: number; // 0–100, derived from completedLessons
  lastLessonId: string | null;
  /** Lesson ids the learner marked complete. */
  completedLessons: string[];
  lastVisitedAt?: string; // ISO
}

export interface LessonNote {
  courseId: string;
  lessonId: string;
  text: string;
  updatedAt: string; // ISO
}

export interface RecentCourseView {
  courseId: string;
  viewedAt: string; // ISO
}

/** A completion certificate issued to the learner, persisted on this device. */
export interface Certificate {
  /** Short, shareable verification code, e.g. "ZYB-7QK2-4M1P". */
  id: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  studentName: string;
  instructorName: string;
  lessonsCount: number;
  durationMinutes: number;
  issuedAt: string; // ISO
}

/**
 * A review written by the learner on this device. Only allowed once the
 * course is completed — see the course player.
 */
export interface CourseReview {
  courseId: string;
  rating: number; // 1–5
  title: string;
  text: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface ActivityItem {
  id: string;
  kind: "enroll" | "lesson" | "order" | "complete";
  courseId: string;
  lessonId?: string;
  text: string;
  at: string; // ISO
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: "course" | "promo" | "system" | "message";
  createdAt: string; // ISO
  href: string;
}

export interface Conversation {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  role: string;
  online: boolean;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  sender: "me" | "them";
  text: string;
  time: string;
}

/* Filtering / sorting */
export type SortOption =
  | "popular"
  | "newest"
  | "rating"
  | "price-asc"
  | "price-desc";

export type PriceFilter = "all" | "free" | "paid";
export type LevelFilter = "all" | CourseLevel;
export type DurationFilter = "all" | "short" | "medium" | "long";
export type LanguageFilter = "all" | CourseLanguage;

export interface CourseFilters {
  price: PriceFilter;
  level: LevelFilter;
  duration: DurationFilter;
  language: LanguageFilter;
  resources: boolean;
}

/* -------------------------------------------------------------------------- */
/* Creator workspace (Prompt 2)                                                */
/* -------------------------------------------------------------------------- */

export type CourseStatus = "draft" | "pending" | "published" | "changes_requested" | "rejected";

export interface CourseReviewEvent {
  id: string;
  at: string; // ISO
  status: CourseStatus;
  actor: "creator" | "reviewer";
  note?: string;
}

export interface UploadedMedia {
  fileName: string;
  fileSize: number; // bytes
  kind: "video" | "resource";
}

/** A course inside the creator workspace: base Course + publishing metadata. */
export interface CreatorCourse extends Course {
  status: CourseStatus;
  reviewHistory: CourseReviewEvent[];
  /** Illustrative lifetime gross revenue for analytics demo (USD). */
  demoRevenue: number;
  /** Frontend-only upload metadata keyed by lesson id. */
  uploads?: Record<string, UploadedMedia[]>;
  /** Course-level downloadable resource entries (metadata only). */
  resourcesExtra?: CreatorResource[];
}

export interface CreatorResource {
  id: string;
  title: string;
  fileType: "video" | "pdf" | "zip" | "doc" | "file";
  sizeMb: number;
}

export interface CourseDraft {
  title: string;
  subtitle: string;
  description: string;
  category: CategorySlug | "";
  level: CourseLevel;
  language: CourseLanguage;
  outcomes: string[];
  requirements: string[];
  audience: string[];
  thumbnail: string;
  isFree: boolean;
  price: number;
  compareAtPrice: number | null;
  sections: CurriculumSection[];
  draftResources: CreatorResource[];
}

export interface CreatorProfile {
  instructorId: string;
  displayName: string;
  headline: string;
  bio: string;
  country: string;
  languages: string[];
  initials: string;
  avatarColor: string;
  avatar?: string;
  website: string;
  topics: string[];
  onboardedAt: string | null;
}

export interface EarningTransaction {
  id: string;
  date: string; // ISO
  courseId: string;
  courseTitle: string;
  orderRef: string;
  status: "paid" | "pending" | "refunded";
  gross: number;
  commission: number;
  net: number;
}

export interface PayoutSettings {
  method: "bank" | "paypal";
  accountName: string;
  details: string; // masked display string
  threshold: number; // USD
}

export interface PayoutRecord {
  id: string;
  period: string;
  amount: number;
  status: "paid" | "processing";
  method: string;
  reference: string;
  requestedAt: string; // ISO
}

export interface CreatorNotification {
  id: string;
  title: string;
  body: string;
  kind: "review" | "sale" | "system" | "payout";
  createdAt: string; // ISO
  href: string;
}

export interface ActivityEvent {
  id: string;
  icon: "enrollment" | "review" | "sale" | "payout" | "course";
  text: string;
  at: string; // ISO
  href?: string;
}

export type AnalyticsRange = "7d" | "30d" | "90d" | "1y";

export interface AnalyticsPoint {
  label: string;
  revenue: number;
  enrollments: number;
}

/* -------------------------------------------------------------------------- */
/* Admin portal (Prompt 4)                                                     */
/* -------------------------------------------------------------------------- */

export type AdminRole = "admin" | "moderator" | "creator" | "learner";
export type AdminAccountStatus = "active" | "suspended";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  role: AdminRole;
  country: string;
  registeredAt: string; // ISO
  lastActiveAt: string; // ISO
  status: AdminAccountStatus;
  coursesCreated: number;
  enrollments: number;
  lifetimeSpend: number; // USD (learners)
}

export interface AdminOrder {
  id: string;
  orderRef: string;
  learnerId: string;
  learnerName: string;
  courseId: string;
  courseTitle: string;
  creatorId: string;
  creatorName: string;
  gross: number;
  commission: number;
  creatorShare: number;
  date: string; // ISO
  status: "paid" | "pending" | "refunded" | "failed";
  method: string; // masked descriptor (demo)
}

export interface AdminPayout {
  id: string;
  creatorId: string;
  creatorName: string;
  eligibleBalance: number;
  amount: number;
  status: "requested" | "approved" | "paid" | "rejected";
  reference: string;
  requestedAt: string; // ISO
  processedAt?: string; // ISO
}

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  order: number;
  visible: boolean;
  courseCount: number;
}

export type ReportStatus = "open" | "under_review" | "resolved" | "dismissed";
export type ReportPriority = "low" | "medium" | "high";

export interface AdminReport {
  id: string;
  type: "course" | "review" | "user";
  targetId: string;
  targetTitle: string;
  targetExcerpt?: string;
  reporterName: string;
  reason: string;
  submittedAt: string; // ISO
  status: ReportStatus;
  priority: ReportPriority;
  adminNote?: string;
}

export interface AdminActivity {
  id: string;
  actor: string; // admin name
  action: string;
  target: string;
  at: string; // ISO
  kind: "moderation" | "user" | "order" | "payout" | "settings" | "review";
}

export interface ModerationNote {
  courseId: string;
  text: string;
  at: string; // ISO
  author: string;
}

export interface AdminSettings {
  marketplaceName: string;
  marketplaceDescription: string;
  currency: "USD" | "EUR" | "GBP";
  commissionRate: number; // fraction, default 0.1
  autoApproveFreeCourses: boolean;
  autoApproveReturningCreators: boolean;
  emailReviewDecisions: boolean;
  requirePayoutApproval: boolean;
  hiddenCategorySlugs: string[];
}

export interface AdminNotification {
  id: string;
  title: string;
  body: string;
  kind: "moderation" | "report" | "payout" | "system";
  createdAt: string; // ISO
  href: string;
}
